const { generatePassword, generateOtp, generateUsername } = require('../../src/services/credentials');

describe('Credentials Service', () => {
  describe('generatePassword()', () => {
    it('should generate a password of specified length', () => {
      const pwd = generatePassword(14);
      expect(pwd).toHaveLength(14);
    });

    it('should contain at least one uppercase, lowercase, digit, and special char', () => {
      const pwd = generatePassword(12);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[!@#$%^&*]/.test(pwd)).toBe(true);
    });
  });

  describe('generateOtp()', () => {
    it('should generate a 6-digit numeric string', () => {
      const otp = generateOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });
  });

  describe('generateUsername()', () => {
    it('should generate base clean username when not taken', async () => {
      const existsFn = jest.fn().mockResolvedValue(false);
      const username = await generateUsername('John Doe', 'john.doe@example.com', existsFn);
      expect(username).toBe('john.doe');
      expect(existsFn).toHaveBeenCalledWith('john.doe');
    });

    it('should append numeric suffix if username is taken', async () => {
      const existsFn = jest.fn()
        .mockResolvedValueOnce(true)  // 'john.doe' taken
        .mockResolvedValueOnce(true)  // 'john.doe1' taken
        .mockResolvedValueOnce(false); // 'john.doe2' free
      const username = await generateUsername('John Doe', 'john@example.com', existsFn);
      expect(username).toBe('john.doe2');
    });

    it('should fall back to email user part when full name is empty', async () => {
      const existsFn = jest.fn().mockResolvedValue(false);
      const username = await generateUsername('', 'jane.smith@geu.ac.in', existsFn);
      expect(username).toBe('jane.smith');
    });
  });
});
