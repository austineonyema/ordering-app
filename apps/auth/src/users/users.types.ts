import { User } from './schemas/user.schema';

type SensitiveUserFields = 'password' | 'refreshTokenHash';

export type PublicUser = Omit<User, SensitiveUserFields>;

export type UserWithPassword = PublicUser & {
  password: string;
};

export type RefreshUserRecord = PublicUser & {
  refreshTokenHash?: string;
};

export function toPublicUser(
  user: User | UserWithPassword | RefreshUserRecord | PublicUser,
): PublicUser {
  const safeUser = { ...user } as Partial<User>;
  delete safeUser.password;
  delete safeUser.refreshTokenHash;

  return safeUser as PublicUser;
}
