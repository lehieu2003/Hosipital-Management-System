import bcrypt from 'bcryptjs';

const DEFAULT_BCRYPT_ROUNDS = 12;
const TEST_BCRYPT_ROUNDS = 1;

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? TEST_BCRYPT_ROUNDS : DEFAULT_BCRYPT_ROUNDS;

export const hashPassword = async (value: string) => {
  return bcrypt.hash(value, BCRYPT_ROUNDS);
};

export const verifyPassword = async (value: string, hash: string) => {
  return bcrypt.compare(value, hash);
};
