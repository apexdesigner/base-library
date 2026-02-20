import { Injectable } from "@angular/core";
import { User } from "./models/user";
import { HttpClient } from "@angular/common/http";

@Injectable
export class UserService {
  baseUrl = "https://api.example.com";

  constructor(private http: HttpClient) {}

  public async getUser(id: string): Promise<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${id}`).toPromise();
  }

  @Cacheable({ ttl: 300 })
  public async updateUser(
    userId: string,
    updates: Partial<User>,
  ): Promise<User> {
    return this.http
      .patch<User>(`${this.baseUrl}/users/${userId}`, updates)
      .toPromise();
  }
}
