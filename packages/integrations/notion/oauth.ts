import { Client } from "@notionhq/client";

export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type NotionOAuthToken = Awaited<ReturnType<Client["oauth"]["token"]>>;

export class NotionOAuthClient {
  private readonly client = new Client({ notionVersion: "2026-03-11" });

  constructor(private readonly config: NotionOAuthConfig) {}

  authorizationUrl(state: string): string {
    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  exchangeCode(code: string): Promise<NotionOAuthToken> {
    return this.client.oauth.token({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
    });
  }

  refresh(refreshToken: string): Promise<NotionOAuthToken> {
    return this.client.oauth.token({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  introspect(token: string) {
    return this.client.oauth.introspect({ client_id: this.config.clientId, client_secret: this.config.clientSecret, token });
  }

  revoke(token: string) {
    return this.client.oauth.revoke({ client_id: this.config.clientId, client_secret: this.config.clientSecret, token });
  }
}
