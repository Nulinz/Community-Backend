import axios from "axios";

export class OtpService {
  constructor() {
    this.authKey = "3834756c696e7a36343939";
    this.senderId = "NULINZ";
    this.baseUrl = "https://promo.smso2.com/api/sendhttp.php";

    // DLT Template IDs - add/modify template IDs as registered on your DLT portal
    this.registerTemplateId = "1777179189592540735";
    this.forgotTemplateId = "1777179180215392927";
  }

  /**
   * Internal dispatcher handling phone formatting, query building, and SMS gateway transport.
   * Centralizes error handling and response normalization for all SMS flows.
   */
  async #dispatchSms({ phone, messageText, templateId, flowName }) {
    try {
      const formattedPhone = phone.startsWith("91") ? phone : `91${phone}`;
      const message = encodeURIComponent(messageText);

      const url =
        `${this.baseUrl}?authkey=${this.authKey}` +
        `&mobiles=${formattedPhone}` +
        `&message=${message}` +
        `&sender=${this.senderId}` +
        `&route=2` +
        `&country=0` +
        `&DLT_TE_ID=${templateId}`;

      const response = await axios.get(url);

      console.log(`[SMS - ${flowName}] Response:`, response.data);

      return {
        success: response.data?.Status === "Success",
        data: response.data,
      };
    } catch (error) {
      console.error(`[SMS - ${flowName}] Failed:`, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Dispatches user registration verification OTP using the approved welcome template.
   */
  async sendRegistrationOtp(phone, name, otp) {
    const message = `Welcome to the Gradenvy Your registration code is: ${otp}. Thank you for joining us ! - NULINZ`;

    return this.#dispatchSms({
      phone,
      messageText: message,
      templateId: this.registerTemplateId,
      flowName: "Registration",
    });
  }

  /**
   * Dispatches password reset OTP.
   * Replace the message format with the exact text approved on your DLT portal.
   */
  async sendForgotOtp(phone, name, otp) {
    const message = `Dear Customer, ${otp} is your password reset code for Gradenvy. - NULINZ`;

    return this.#dispatchSms({
      phone,
      messageText: message,
      templateId: this.forgotTemplateId,
      flowName: "ForgotPassword",
    });
  }

  /**
   * Backward-compatible alias for existing caller code.
   */
  async sendOtp(phone, name, otp) {
    return this.sendRegistrationOtp(phone, name, otp);
  }
}

export default new OtpService();