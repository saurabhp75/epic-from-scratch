import { generateTOTP } from '@epic-web/totp'

// Paste your string here. It should start with "otpauth://totp/"
// and run this file using "node app/utils/otp.js" to get code
const otpString = `otpauth://totp/localhost%3A3000:kody%40kcd.dev?secret=GZ4SJ33F55SL23KK&issuer=localhost%3A3000&algorithm=SHA1&digits=6&period=30`

const otpUri = new URL(otpString)
const { secret, algorithm, digits, period } = Object.fromEntries(
	otpUri.searchParams.entries(),
)

const { otp } = generateTOTP({
	secret,
	algorithm,
	digits,
	period,
})

console.log(otp)
