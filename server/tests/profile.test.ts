import { describe, it, expect } from 'vitest';
import { UserService } from '../src/services/userService';

describe('UserService', () => {
  const userService = new UserService();

  describe('isProfileComplete', () => {
    it('should return complete for full profile', () => {
      const result = userService.isProfileComplete({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@gmail.com',
      });
      expect(result.complete).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing first name', () => {
      const result = userService.isProfileComplete({
        firstName: null,
        lastName: 'Doe',
        email: 'john@gmail.com',
      });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain('نام');
    });

    it('should detect missing last name', () => {
      const result = userService.isProfileComplete({
        firstName: 'John',
        lastName: null,
        email: 'john@gmail.com',
      });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain('نام خانوادگی');
    });

    it('should detect missing email', () => {
      const result = userService.isProfileComplete({
        firstName: 'John',
        lastName: 'Doe',
        email: null,
      });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain('ایمیل');
    });

    it('should detect all missing fields', () => {
      const result = userService.isProfileComplete({
        firstName: null,
        lastName: null,
        email: null,
      });
      expect(result.complete).toBe(false);
      expect(result.missing).toHaveLength(3);
    });
  });
});
