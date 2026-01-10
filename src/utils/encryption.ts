import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

// Ключи в браузере будем хранить в localStorage
const PUBLIC_KEY_STORAGE = "@e2ee_public_key";
const PRIVATE_KEY_STORAGE = "@e2ee_private_key";

export const getStoredKeyPair = () => {
  const pub = localStorage.getItem(PUBLIC_KEY_STORAGE);
  const priv = localStorage.getItem(PRIVATE_KEY_STORAGE);

  if (!pub || !priv) return null;

  return {
    publicKey: naclUtil.decodeBase64(pub),
    privateKey: naclUtil.decodeBase64(priv),
    publicKeyB64: pub,
    privateKeyB64: priv,
  };
};

// Функция шифрования текста (1-в-1 как в мобилке)
export const encryptMessage = (message: string, theirPublicKey: Uint8Array, myPrivateKey: Uint8Array) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = naclUtil.decodeUTF8(message);
  const encrypted = nacl.box(messageUint8, nonce, theirPublicKey, myPrivateKey);

  return {
    ciphertext: naclUtil.encodeBase64(encrypted),
    nonce: naclUtil.encodeBase64(nonce),
  };
};

// Функция расшифровки текста
export const decryptMessage = (
  ciphertextB64: string,
  nonceB64: string,
  myPrivateKey: Uint8Array,
  senderPublicKey: Uint8Array
) => {
  try {
    const ciphertext = naclUtil.decodeBase64(ciphertextB64);
    const nonce = naclUtil.decodeBase64(nonceB64);
    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, myPrivateKey);

    if (!decrypted) return "[Ошибка расшифровки]";

    return naclUtil.encodeUTF8(decrypted);
  } catch (e) {
    console.error("Decryption error:", e);
    return "[Ошибка декодирования]";
  }
};
export const generateTempKeyPair = () => {
  const pair = nacl.box.keyPair();
  return {
    publicKey: pair.publicKey,
    secretKey: pair.secretKey,
    publicKeyB64: naclUtil.encodeBase64(pair.publicKey),
  };
};
