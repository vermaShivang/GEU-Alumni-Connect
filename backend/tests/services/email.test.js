const { sendMail, approvalEmail, rejectionEmail, otpEmail } = require('../../src/services/email');

describe('Email Service', () => {
  describe('Email templates', () => {
    it('should create approval email template correctly', () => {
      const result = approvalEmail({
        fullName: 'Alice Smith',
        username: 'alice.smith',
        password: 'SecretPassword123!',
        loginUrl: 'http://localhost:8080/login'
      });
      expect(result.subject).toContain('Your account has been approved');
      expect(result.text).toContain('Alice Smith');
      expect(result.text).toContain('alice.smith');
      expect(result.text).toContain('SecretPassword123!');
    });

    it('should create rejection email template correctly', () => {
      const result = rejectionEmail({
        fullName: 'Bob Jones',
        reason: 'Document illegible'
      });
      expect(result.subject).toContain('Registration update');
      expect(result.text).toContain('Bob Jones');
      expect(result.text).toContain('Document illegible');
    });

    it('should create OTP email template correctly for change_password', () => {
      const result = otpEmail({
        fullName: 'Charlie Brown',
        code: '123456',
        purpose: 'change_password'
      });
      expect(result.subject).toContain('123456');
      expect(result.text).toContain('change your password');
    });
  });

  describe('sendMail() console fallback mode', () => {
    let consoleLogSpy;

    beforeEach(() => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log email to console when SMTP is not configured', async () => {
      const result = await sendMail({
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Hello World'
      });
      expect(result).toEqual({ ok: true, mode: 'console' });
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
