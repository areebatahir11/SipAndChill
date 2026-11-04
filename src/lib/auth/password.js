import bcrypt from 'bcryptjs';

const COST = 12;
export const hashPassword = (plain) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Compared against when the email is unknown, so "no such user" costs the same time as
// "wrong password" and cannot be told apart by response time.
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);
