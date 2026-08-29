import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { auth } from './auth';

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

@Injectable()
export class AuthService {
  async register(data: RegisterDto, reqHeaders: Headers) {
    if (!data.name || !data.email || !data.password) {
      throw new BadRequestException('Ad Soyad, e-posta ve şifre zorunludur.');
    }

    if (data.password.length < 8) {
      throw new BadRequestException('Şifre en az 8 karakter olmalıdır.');
    }

    try {
      const response = await auth.api.signUpEmail({
        body: {
          name: data.name,
          email: data.email,
          password: data.password,
        },
        headers: reqHeaders,
        asResponse: true,
      });

      return response;
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Kayıt işlemi başarısız oldu.');
    }
  }

  async login(data: LoginDto, reqHeaders: Headers) {
    if (!data.email || !data.password) {
      throw new BadRequestException('E-posta ve şifre zorunludur.');
    }

    try {
      const response = await auth.api.signInEmail({
        body: {
          email: data.email,
          password: data.password,
          rememberMe: data.rememberMe ?? false,
        },
        headers: reqHeaders,
        asResponse: true,
      });

      return response;
    } catch (error: any) {
      throw new UnauthorizedException(error.message || 'Giriş bilgileri hatalı.');
    }
  }

  async getSession(reqHeaders: Headers) {
    try {
      const session = await auth.api.getSession({
        headers: reqHeaders,
      });

      return session;
    } catch {
      return null;
    }
  }

  async logout(reqHeaders: Headers) {
    try {
      const response = await auth.api.signOut({
        headers: reqHeaders,
        asResponse: true,
      });

      return response;
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Çıkış işlemi başarısız.');
    }
  }
}
