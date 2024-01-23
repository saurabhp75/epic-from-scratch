import bcrypt from 'bcryptjs'
// We cannot simply import bcrypt in the routes
// file as bcrypt needs crypto, which will end up
// in the client bundle
export { bcrypt }
