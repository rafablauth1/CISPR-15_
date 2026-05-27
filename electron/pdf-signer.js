'use strict'

const { execSync } = require('child_process')
const forge = require('node-forge')
const { plainAddPlaceholder } = require('@signpdf/placeholder-plain')
const { SignPdf, Signer } = require('@signpdf/signpdf')

/**
 * Lista certificados com chave privada disponíveis no Windows Certificate Store.
 * Retorna array de { subject, thumbprint, notAfter, issuer }
 */
function listSigningCerts() {
  try {
    const lines = [
      '$certs = @(Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) })',
      'if ($certs.Count -eq 0) { Write-Output "[]"; exit }',
      '$arr = $certs | ForEach-Object { [pscustomobject]@{ subject=$_.Subject; thumbprint=$_.Thumbprint; notAfter=$_.NotAfter.ToString("yyyy-MM-dd"); issuer=$_.Issuer } }',
      'ConvertTo-Json -InputObject @($arr) -Compress',
    ]
    const out = execSync(
      `powershell -NoProfile -Command "${lines.join('; ')}"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim()
    if (!out) return []
    return JSON.parse(out)
  } catch {
    return []
  }
}

/**
 * Obtém o DER do certificado pelo thumbprint (Windows Cert Store).
 */
function getCertDer(thumbprint) {
  const script = `$c = Get-Item 'Cert:\\CurrentUser\\My\\${thumbprint}'; [Convert]::ToBase64String($c.RawData)`
  const out = execSync(
    `powershell -NoProfile -Command "${script}"`,
    { encoding: 'utf8', timeout: 10000 }
  ).trim()
  return Buffer.from(out, 'base64')
}

/**
 * Assina um hash SHA-256 usando a chave privada do certificado via Windows CNG.
 * Funciona com tokens A3 software — a chave nunca sai do token.
 */
function signHashWithWindowsCNG(thumbprint, hashBase64) {
  const script = [
    `$cert = Get-Item 'Cert:\\CurrentUser\\My\\${thumbprint}'`,
    `$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)`,
    `$hash = [Convert]::FromBase64String('${hashBase64}')`,
    `$sig = $rsa.SignHash($hash, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)`,
    `[Convert]::ToBase64String($sig)`,
  ].join('; ')
  const out = execSync(
    `powershell -NoProfile -Command "${script}"`,
    { encoding: 'utf8', timeout: 30000 }
  ).trim()
  return Buffer.from(out, 'base64')
}

class WindowsCNGSigner extends Signer {
  constructor(thumbprint) {
    super()
    this.thumbprint = thumbprint
  }

  async sign(pdfBuffer, signingTime) {
    const thumbprint = this.thumbprint

    // Obtém o certificado do Windows Certificate Store
    const certDer = getCertDer(thumbprint)
    const certForge = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(forge.util.createBuffer(certDer))
    )

    // Chave proxy: delega a operação RSA ao Windows CNG (o token nunca expõe a chave privada)
    const proxyKey = {
      sign: function(md) {
        const hashBytes = md.digest().bytes()
        const hashBase64 = Buffer.from(hashBytes, 'binary').toString('base64')
        const sigBuffer = signHashWithWindowsCNG(thumbprint, hashBase64)
        return sigBuffer.toString('binary')
      }
    }

    // Monta o PKCS#7 / CMS SignedData usando node-forge
    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer(pdfBuffer.toString('binary'))
    p7.addCertificate(certForge)
    p7.addSigner({
      key: proxyKey,
      certificate: certForge,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.signingTime, value: signingTime || new Date() },
        { type: forge.pki.oids.messageDigest },
      ],
    })
    p7.sign({ detached: true })

    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary')
  }
}

/**
 * Assina um Buffer PDF usando o certificado identificado pelo thumbprint.
 * Retorna Buffer do PDF assinado.
 */
async function signPDF(pdfBuffer, thumbprint) {
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: 'Relatório CISPR 15 — LABELO/PUCRS',
    contactInfo: 'labelo@pucrs.br',
    name: 'LABELO/PUCRS',
    location: 'Porto Alegre, RS, Brasil',
    signatureLength: 16384, // 8 KB para comportar certificados A3 com cadeia completa
  })

  const signed = await new SignPdf().sign(pdfWithPlaceholder, new WindowsCNGSigner(thumbprint))
  return Buffer.from(signed)
}

module.exports = { listSigningCerts, signPDF }
