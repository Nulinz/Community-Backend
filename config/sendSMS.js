import axios from "axios";

export class OtpService {
  constructor() {
    this.authKey = "3834756c696e7a36343939";
    this.senderId = "NULINZ";
    this.templateId = "1707172951004827514";
    this.baseUrl = "https://promo.smso2.com/api/sendhttp.php";
  }

  async sendOtp(phone, name, otp) {
    try {
      const formattedPhone = phone.startsWith("91")
        ? phone
        : `91${phone}`;

      const message = encodeURIComponent(
        `Welcome ${name} to the Nulinz Community! Your registration code is:${otp}. Thank you for joining us!`
      );

      const url =
        `${this.baseUrl}?authkey=${this.authKey}` +
        `&mobiles=${formattedPhone}` +
        `&message=${message}` +
        `&sender=${this.senderId}` +
        `&route=2` +
        `&country=0` +
        `&DLT_TE_ID=${this.templateId}`;

      const response = await axios.get(url);

      console.log("SMS Response:", response.data);

      return {
        success: response.data?.Status === "Success",
        data: response.data,
      };

    } catch (error) {
      console.error("SMS sending failed:", error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new OtpService();