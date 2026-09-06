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

  /**
   * Resolves direct product URL on athena.co.nz based on nominated prize string or SKU
   */
  getPrizeUrl(nominatedPrize) {
    if (!nominatedPrize) {
      return 'https://athena.co.nz/products?utm_source=mailchimp&utm_medium=email&utm_campaign=bubbles_confirm';
    }

    const str = String(nominatedPrize).toUpperCase();
    
    // Direct SKU Code to Athena Product URL mapping
    const skuMap = {
      'AR060DMKVA43': 'https://athena.co.nz/products/array-kawhia-nera-600-double-drawer-wall-vanity',
      'TNAR035K43L': 'https://athena.co.nz/products/350-array-kawhia-storage-tower',
      'TWAR035K43L': 'https://athena.co.nz/products/350-array-kawhia-storage-tower',
      'AR05HFLKSA27R': 'https://athena.co.nz/products/500-array-kawhia-serifos-floor-standing-hand-basin?variant=45480682913889',
      'AR120SNOSN43DR': 'https://athena.co.nz/products/array-oslo-laminam-1200-2-drawer-vanity?variant=42299169079393',
      'SFVT15DSN35DR': 'https://athena.co.nz/products/verto-serifos-1500-double-basin-2-drawer-wall-vanity?variant=42299221639265',
      'KV09002SNZ': 'https://athena.co.nz/products/kavoro-900-single-drawer',
      'AR100SNRSA27': 'https://athena.co.nz/products/array_riada_serifos_1000_wall_vanity?variant=41090101215329',
      'ZWSY090405NZ': 'https://athena.co.nz/products/900-zephyr-syrtari-single-drawer',
      'AR075DMBVA46': 'https://athena.co.nz/products/array-berlin-nera-750-1-drawer-vanity',
      'BFSN05WH100': 'https://athena.co.nz/products/sena-soak-bath',
      'BFES05WH165': 'https://athena.co.nz/products/esara-bath?variant=45320462008417',
      'TRSFAN11R': 'https://athena.co.nz/products/slateforma-artus-1000x1000-2-wall-shower',
      'TRSFCH81': 'https://athena.co.nz/products/slateforma-artus-1800x1000-two-wall-shower',
      'ALUME090RECBL': 'https://athena.co.nz/products/600x900-alume-led-back-lit-mirror',
      'ALUME090RECFL': 'https://athena.co.nz/products/600x900-alume-led-front-lit-mirror',
      'VBCIMW038': 'https://athena.co.nz/products/circa-basin',
      'VBECMW042': 'https://athena.co.nz/products/echo-basin',
      'VBOUMW050': 'https://athena.co.nz/products/outro-basin',
      'VBQDMW042': 'https://athena.co.nz/products/quadra-basin',
      'VBSWMW060': 'https://athena.co.nz/products/swift-basin',
      'VBRV036': 'https://athena.co.nz/products/rivae-basin'
    };

    for (const [sku, url] of Object.entries(skuMap)) {
      if (str.includes(sku)) {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}utm_source=mailchimp&utm_medium=email&utm_campaign=bubbles_confirm`;
      }
    }

    // Keyword fallbacks
    const keywordMap = [
      { kw: 'STORAGE TOWER', url: 'https://athena.co.nz/products/350-array-kawhia-storage-tower' },
      { kw: 'KAWHIA', url: 'https://athena.co.nz/products/array-kawhia-nera-600-double-drawer-wall-vanity' },
      { kw: 'OSLO', url: 'https://athena.co.nz/products/array-oslo-laminam-1200-2-drawer-vanity?variant=42299169079393' },
      { kw: 'VERTO', url: 'https://athena.co.nz/products/verto-serifos-1500-double-basin-2-drawer-wall-vanity?variant=42299221639265' },
      { kw: 'KAVORO', url: 'https://athena.co.nz/products/kavoro-900-single-drawer' },
      { kw: 'RIADA', url: 'https://athena.co.nz/products/array_riada_serifos_1000_wall_vanity?variant=41090101215329' },
      { kw: 'ZEPHYR', url: 'https://athena.co.nz/products/900-zephyr-syrtari-single-drawer' },
      { kw: 'BERLIN', url: 'https://athena.co.nz/products/array-berlin-nera-750-1-drawer-vanity' },
      { kw: 'SENA', url: 'https://athena.co.nz/products/sena-soak-bath' },
      { kw: 'ESARA', url: 'https://athena.co.nz/products/esara-bath?variant=45320462008417' },
      { kw: 'ARTUS', url: 'https://athena.co.nz/products/slateforma-artus-1000x1000-2-wall-shower' },
      { kw: 'MOTIO', url: 'https://athena.co.nz/products/slateforma-artus-1800x1000-two-wall-shower' },
      { kw: 'BACKLIT', url: 'https://athena.co.nz/products/600x900-alume-led-back-lit-mirror' },
      { kw: 'FRONTLIT', url: 'https://athena.co.nz/products/600x900-alume-led-front-lit-mirror' },
      { kw: 'CIRCA', url: 'https://athena.co.nz/products/circa-basin' },
      { kw: 'ECHO', url: 'https://athena.co.nz/products/echo-basin' },
      { kw: 'OUTRO', url: 'https://athena.co.nz/products/outro-basin' },
      { kw: 'QUADRA', url: 'https://athena.co.nz/products/quadra-basin' },
      { kw: 'SWIFT', url: 'https://athena.co.nz/products/swift-basin' },
      { kw: 'RIVAE', url: 'https://athena.co.nz/products/rivae-basin' },
      { kw: 'MOTIF', url: 'https://athena.co.nz/products/sena-soak-bath' },
      { kw: 'SOLSTICE', url: 'https://athena.co.nz/products/slateforma-motio-2-1200x900-two-wall-shower' },
      { kw: 'HALO', url: 'https://athena.co.nz/products/800-alume-led-round-back-lit-mirror' }
    ];

    for (const item of keywordMap) {
      if (str.includes(item.kw)) {
        const sep = item.url.includes('?') ? '&' : '?';
        return `${item.url}${sep}utm_source=mailchimp&utm_medium=email&utm_campaign=bubbles_confirm`;
      }
    }

    return 'https://athena.co.nz/products?utm_source=mailchimp&utm_medium=email&utm_campaign=bubbles_confirm';
  }

  async syncBubblesEntry(data) {
    const subscriberHash = this._getSubscriberHash(data.email);
    const isSubscribed = Boolean(data.marketingConsent);
    const prizeUrl = this.getPrizeUrl(data.nominatedPrize);

    const mergeFields = {
      FIRST: data.firstName || '',
      FNAME: data.firstName || '',
      LAST: data.lastName || '',
      LNAME: data.lastName || '',
      PHONE: data.mobile || '',
      POSTCODE: data.postcode ? String(data.postcode) : '',
      SIGNUPVIA: 'Event // Show',
      BUSINESSSCA: 'Consumer',
      BUBBLE_GSS: data.bubbleGuess ? Number(data.bubbleGuess) : 0,
      PRIZE_NOM: data.nominatedPrize || '',
      PRIZE_URL: prizeUrl,
      EVENT: data.event || 'Home Show Auckland 2026',
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

    // Format configuration summary string
    let cfgString = '';
    if (typeof data.configuration === 'object' && data.configuration !== null) {
      const c = data.configuration;
      cfgString = `${c.size || ''} | ${c.style || ''} | ${c.drawer || ''} | ${c.topMaterial || ''} | ${c.finish || ''} | ${c.handle || ''} | ${c.mounting || ''}`;
    } else {
      cfgString = data.configuration || '';
    }

    const mergeFields = {
      FIRST: data.firstName || '',
      FNAME: data.firstName || '',
      LAST: data.lastName || '',
      LNAME: data.lastName || '',
      PHONE: data.mobile || '',
      POSTCODE: data.postcode ? String(data.postcode) : '',
      SIGNUPVIA: 'Event // Show',
      BUSINESSSCA: 'Consumer',
      ARRAY_CFG: cfgString,
      ARRAY_URL: data.arrayUrl || 'https://athena.co.nz/pages/array-builder',
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