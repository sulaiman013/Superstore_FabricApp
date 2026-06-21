import type { AuthUser, IAuthService } from './IAuthService';

const PREVIEW_USER: AuthUser = {
  id: 'preview-operator',
  email: 'demo@superstore.local',
  name: 'Demo Operator',
};

/** Offline auth for `npm run dev:preview`: no backend, always signed in. */
export class PreviewAuthService implements IAuthService {
  readonly fabricAuthEnabled = false;

  async signIn(): Promise<AuthUser> {
    return PREVIEW_USER;
  }

  async signOut(): Promise<void> {}

  async getCurrentUser(): Promise<AuthUser | null> {
    return PREVIEW_USER;
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    return PREVIEW_USER;
  }
}
