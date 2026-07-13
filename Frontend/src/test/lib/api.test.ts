import { describe, it, expect, beforeEach } from 'vitest';
import { saveToken, clearToken, fileUrl } from '../../lib/api';

describe('API Client Helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token Management', () => {
    it('should save token to localStorage', () => {
      saveToken('test.jwt.token');
      expect(localStorage.getItem('geu_token')).toBe('test.jwt.token');
    });

    it('should clear token from localStorage', () => {
      saveToken('token-to-remove');
      clearToken();
      expect(localStorage.getItem('geu_token')).toBeNull();
    });
  });

  describe('fileUrl()', () => {
    it('should return null for empty input', () => {
      expect(fileUrl(null)).toBeNull();
      expect(fileUrl('')).toBeNull();
    });

    it('should return unchanged URL if absolute http/https', () => {
      expect(fileUrl('https://res.cloudinary.com/demo/image.png'))
        .toBe('https://res.cloudinary.com/demo/image.png');
    });

    it('should prefix BASE URL for relative upload paths', () => {
      const result = fileUrl('/uploads/doc.pdf');
      expect(result).toContain('/uploads/doc.pdf');
      expect(result).toMatch(/^http/);
    });
  });
});
