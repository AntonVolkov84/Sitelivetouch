import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const PUBLIC_KEY_STORAGE = "e2ee_public_key";
const PRIVATE_KEY_STORAGE = "e2ee_private_key";

export const getOrGenerateKeyPair = () => {
  const existingPub = localStorage.getItem(PUBLIC_KEY_STORAGE);
  const existingPriv = localStorage.getItem(PRIVATE_KEY_STORAGE);

  if (existingPub && existingPriv) {
    return {
      publicKey: naclUtil.decodeBase64(existingPub),
      secretKey: naclUtil.decodeBase64(existingPriv),
    };
  }

  // Генерируем новую пару, если нет старой
  const keyPair = nacl.box.keyPair();
  localStorage.setItem(PUBLIC_KEY_STORAGE, naclUtil.encodeBase64(keyPair.publicKey));
  localStorage.setItem(PRIVATE_KEY_STORAGE, naclUtil.encodeBase64(keyPair.secretKey));

  return keyPair;
};

// Функция для получения публичного ключа в Base64 для отправки на бэк
export const getEncodedPublicKey = (): string => {
  const keyPair = getOrGenerateKeyPair();
  return naclUtil.encodeBase64(keyPair.publicKey);
};

// Аналог шифрования (понадобится позже в чате)
export const encryptMessage = (message: string, theirPublicKeyB64: string) => {
  const { secretKey } = getOrGenerateKeyPair();
  const theirPublicKey = naclUtil.decodeBase64(theirPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = naclUtil.decodeUTF8(message);

  const encrypted = nacl.box(messageUint8, nonce, theirPublicKey, secretKey);

  return {
    ciphertext: naclUtil.encodeBase64(encrypted),
    nonce: naclUtil.encodeBase64(nonce),
  };
};
