import { ApiClient } from './apiClient';
import usersFixture from '../fixtures/users.json';

export class AuthHelper {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  async registerAndLogin(userData?: any): Promise<string> {
    const user = userData || usersFixture.validUser;

    // Registrar usuário
    const registerResponse = await this.apiClient.register(user);
    
    if (registerResponse.status !== 201) {
      throw new Error(`Failed to register user: ${JSON.stringify(registerResponse.body)}`);
    }

    // Retornar token
    return registerResponse.body.token;
  }

  async getAuthenticatedClient(userData?: any): Promise<ApiClient> {
    const token = await this.registerAndLogin(userData);
    this.apiClient.setToken(token);
    return this.apiClient;
  }
}