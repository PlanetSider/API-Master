import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

const ENCRYPTION_VERSION = "v1"

export class StateCipher {
  private readonly key: Buffer

  constructor(secret: string) {
    this.key = createHash("sha256").update(secret).digest()
  }

  encrypt(value: unknown): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", this.key, iv)
    const plaintext = Buffer.from(JSON.stringify(value), "utf8")
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()

    return [
      ENCRYPTION_VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".")
  }

  decrypt<T>(envelope: string): T {
    const [version, ivValue, tagValue, ciphertextValue] = envelope.split(".")
    if (
      version !== ENCRYPTION_VERSION ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue
    ) {
      throw new Error("Unsupported encrypted state envelope")
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivValue, "base64url"),
    )
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ])

    return JSON.parse(plaintext.toString("utf8")) as T
  }
}
