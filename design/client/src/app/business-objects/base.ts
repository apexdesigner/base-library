import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export class BusinessObjectBase {
  static httpClient: HttpClient;
  static baseUrl = '/api';

  static configure(httpClient: HttpClient): void {
    BusinessObjectBase.httpClient = httpClient;
  }

  constructor(data: any) {
    Object.assign(this, data);
  }

  protected static get<T>(url: string, params?: Record<string, string>): Promise<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        httpParams = httpParams.set(key, value);
      }
    }
    return firstValueFrom(this.httpClient.get<T>(url, { params: httpParams }));
  }

  protected static post<T>(url: string, body: any): Promise<T> {
    return firstValueFrom(this.httpClient.post<T>(url, body));
  }

  protected static patch<T>(url: string, body: any): Promise<T> {
    return firstValueFrom(this.httpClient.patch<T>(url, body));
  }

  protected static del<T>(url: string): Promise<T> {
    return firstValueFrom(this.httpClient.delete<T>(url));
  }
}
