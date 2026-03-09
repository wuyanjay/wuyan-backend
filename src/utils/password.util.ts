import * as argon2 from 'argon2';

export class PasswordUtil {
  private static readonly ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 4
  };
  
  static async hash(password: string): Promise<string> {
    return await argon2.hash(password, this.ARGON2_OPTIONS);
  }
  
  static async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  
  static validateStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number; // 0-5
  } {
    const errors: string[] = [];
    let score = 0;
    
    if (password.length < 8) {
      errors.push('密码长度至少为 8 位');
    } else {
      score++;
      if (password.length >= 12) score++;
      if (password.length >= 16) score++;
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('密码需要包含小写字母');
    } else {
      score++;
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('密码需要包含大写字母');
    } else {
      score++;
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('密码需要包含数字');
    }
    
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score++;
    }
    
    // 检查常见弱密码
    const commonPasswords = [
      'password', '123456', '12345678', 'qwerty', 'abc123',
      'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
      '1234567890', 'password123', 'admin', 'welcome', 'login'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('密码过于常见，请更换一个更复杂的密码');
      score = 0;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      score: Math.min(score, 5)
    };
  }
}
