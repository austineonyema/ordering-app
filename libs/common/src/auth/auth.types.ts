export type TokenPurpose = 'access' | 'refresh';

export type PlainAuth = {
  userId: string;
  email: string;
  type: TokenPurpose;
};

export type AccessTokenClaims = PlainAuth & {
  type: 'access';
};

export type RefreshTokenClaims = PlainAuth & {
  type: 'refresh';
};
