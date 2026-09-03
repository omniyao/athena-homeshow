    const {
      firstName,
      lastName,
      email,
      mobile,
      address,
      postcode,
      configuration,
      arrayUrl,
      marketingConsent,
      event
    } = req.body;

    if (!email || !firstName) {
      return res.status(400).json({ error: 'Missing required customer details.' });
    }

    const showLocation = event || 'Home Show Auckland 2026';

    // 1. Process Beyond Soap 100/day logic
    const soapResult = beyondSoapManager.processArraySubmission(email, showLocation);

    // Build or fallback the exact reopening URL for Mailchimp
    const finalArrayUrl = arrayUrl || (function() {
      if (configuration && typeof configuration === 'object') {
        const p = [];
        if (configuration.finish) p.push('finish=' + encodeURIComponent(configuration.finish));
        if (configuration.size) p.push('size=' + encodeURIComponent(String(configuration.size).replace(/mm/i, '')));
        if (configuration.style) p.push('style=' + encodeURIComponent(configuration.style));
        if (configuration.drawer) p.push('drawer=' + encodeURIComponent(configuration.drawer));
        if (configuration.topMaterial) p.push('top=' + encodeURIComponent(configuration.topMaterial));
        if (configuration.mounting) p.push('mounting=' + encodeURIComponent(configuration.mounting));
        if (configuration.internalDrawer) p.push('internal=' + encodeURIComponent(configuration.internalDrawer));
        if (configuration.handle) p.push('handle=' + encodeURIComponent(configuration.handle));
        p.push('step=5');
        return 'https://athena.co.nz/pages/array-builder?' + p.join('&');
      }
      return 'https://athena.co.nz/pages/array-builder';
    })();

    const submissionRecord = {
      id: 'ARR-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      mobile,
      address,
      postcode,
      configuration,
      arrayUrl: finalArrayUrl,
      soapResult,
      marketingConsent: Boolean(marketingConsent),
      event: showLocation,
      submittedAt: new Date().toISOString()
    };

    // 2. Store to Array records
    appendRecord(ARRAY_DB, submissionRecord);

    // 3. Sync / Upsert to Mailchimp
    const mcResult = await mailchimpClient.syncArraySubmission(submissionRecord, soapResult);
