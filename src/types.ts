export type LoginFormData = {
  email: string;
  password: string;
};
export type UserAuthData = {
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  email: string;
  id: number;
  is_verified: Boolean;
  username: string;
  usersurname: string;
  public_key: string;
  phone: string;
  role?: string;
};
export type RegisterFormData = {
  username: string;
  usersurname: string;
  email: string;
  password: string;
  manufacturer?: string | undefined;
};
export interface UserChat {
  id: number;
  username: string;
  usersurname: string;
  email: string;
  avatar_url?: string | null;
  phone?: string | null;
  public_key: string;
}

export interface Chat {
  chat_id: number;
  created_at: string;
  name?: string | null;
  type: "private" | "group";
  otherUser?: UserChat;
}
export type KeyPair = {
  publicKey: string;
  privateKey: string;
};
export type DecryptedMessage = {
  chat_id: number;
  ciphertext: string;
  created_at: string;
  id: number;
  nonce: string;
  sender_id: number;
  text: string;
  sender_name: string;
  sender_surname: string;
  sender_avatar: string;
  user_id?: number;
  parent_id: number;
  sender_public_key?: string;
  updated_at?: string;
};
export type GetParticipantsData = {
  public_key: string;
  id: number;
  username: string;
  usersurname: string;
};
export type EncryptedMessages = {
  ciphertext: string;
  nonce: string;
  user_id: number;
};
export type UnreadContextType = {
  unreadChats: Set<number>;
  setUnreadChats: React.Dispatch<React.SetStateAction<Set<number>>>;
};
export type PushType = "private" | "group";
export interface ProfilePayload {
  id: number;
  username: string;
  usersurname: string;
  avatar_url: string | null;
  email: string | null;
  bio: string | null;
  phone: string | null;
}
export type ImagePickerAsset = {
  assetId?: string | null;
  uri: string;
  width: number;
  height: number;
  type: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  duration?: number | null;
};

export type EncryptedData = {
  encryptedImage: Uint8Array;
  nonceImage: string;
  encryptedSymmetricKey: string;
  nonceSymmetricKey: string;
};
export type PushData = { chatId: number; callerId: number; callerName: string; isIncoming: boolean; type?: string };
export interface IProduct {
  id: number;
  name: string;
  price: string;
  description: string;
  quantities: string;
  image_url?: string;
}
