/**
 * Mailchimp API v3 Client & Deduplication Handler
 */
const crypto = require('crypto');
const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX
});

const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;

class MailchimpClient {
  _getSubscriberHash(email) {
    return crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  }

  async syncBubblesEntry(data) {
    const subscriberHash = this._getSubscriberHash(data.email);
    const isSubscribed = Boolean(data.marketingConsent);

    const mergeFields = {
      FIRST: data.firstName || '',   // Exact match for Athena audience
      FNAME: data.firstName || '',   // Fallback for standard audiences
      LAST: data.lastName || '',
      LNAME: data.lastName || '',
      PHONE: data.mobile || '',
      POSTCODE: data.postcode ? String(data.postcode) : '',
      SIGNUPVIA: 'Event // Show',
      BUSINESSSCA: 'Consumer',
      BUBBLE_GSS: data.bubbleGuess ? Number(data.bubbleGuess) : 0,
      PRIZE_NOM: data.nominatedPrize || '',
      MMERGE14: data.bubbleGuess ? Number(data.bubbleGuess) : 0,
      PROJECT: data.nominatedPrize || ''
    };

    const tagsToAdd = [
      data.event || 'Home Show Auckland 2026',
      'Bubbles Competition'
    ];

    try {
      const response = await mailchimp.lists.setListMember(AUDIENCE_ID, subscriberHash, {
        email_address: data.email.toLowerCase().trim(),
        status: isSubscribed ? 'subscribed' : 'unsubscribed',
        merge_fields: mergeFields
      });

      await mailchimp.lists.updateListMemberTags(AUDIENCE_ID, subscriberHash, {
        tags: tagsToAdd.map(t => ({ name: t, status: 'active' }))
      });

      console.log(`[Mailchimp SUCCESS] Successfully synced ${data.email} to Athena audience!`);
      return { success: true, contactId: response.id };
    } catch (error) {
      console.error(`[Mailchimp Error] Failed to sync ${data.email}:`, error.response ? error.response.text : error.message);
      return { success: false, error: error.message };
    }
  }

  async syncArraySubmission(data, soapResult) {
    const subscriberHash = this._getSubscriberHash(data.email);
    const isSubscribed = Boolean(data.marketingConsent);

    const mergeFields = {
      FIRST: data.firstName || '',
      FNAME: data.firstName || '',
      LAST: data.lastName || '',
      LNAME: data.lastName || '',
      PHONE: data.mobile || '',
      POSTCODE: data.postcode ? String(data.postcode) : '',
      SIGNUPVIA: 'Event // Show',
      BUSINESSSCA: 'Consumer',
      ARRAY_CFG: typeof data.configuration === 'object' ? JSON.stringify(data.configuration) : (data.configuration || ''),
      SOAP_STAT: soapResult.isEligible ? 'Eligible' : 'Not Eligible',
      SOAP_CODE: soapResult.voucherCode || 'N/A'
    };

    const tagsToAdd = [
      data.event || 'Home Show Auckland 2026',
      'Array Vanity',
      soapResult.isEligible ? 'Beyond Soap Eligible' : 'Beyond Soap Not Eligible'
    ];

    try {
      const response = await mailchimp.lists.setListMember(AUDIENCE_ID, subscriberHash, {
        email_address: data.email.toLowerCase().trim(),
        status: isSubscribed ? 'subscribed' : 'unsubscribed',
        merge_fields: mergeFields
      });

      await mailchimp.lists.updateListMemberTags(AUDIENCE_ID, subscriberHash, {
        tags: tagsToAdd.map(t => ({ name: t, status: 'active' }))
      });

      console.log(`[Mailchimp SUCCESS] Successfully synced Array submission for ${data.email}!`);
      return { success: true, contactId: response.id };
    } catch (error) {
      console.error(`[Mailchimp Error] Failed to sync Array submission for ${data.email}:`, error.response ? error.response.text : error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MailchimpClient();