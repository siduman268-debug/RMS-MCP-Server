// Lightning Web Component Controller
import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class RmsAppEmbedded extends LightningElement {
    // Get RMS URL from custom metadata or hardcode
    // RMS subdomain: rms.propelor.io (HTTPS enabled)
    // n8n subdomain: agents.propelor.io (already running)
    rmsUrl = 'https://rms.propelor.io';
    
    // Optional: Use custom metadata for URL
    // @wire(getCustomMetadata)
    // wiredMetadata({ error, data }) {
    //     if (data) {
    //         this.rmsUrl = data.rmsUrl__c;
    //     }
    // }
    
    // Optional: Accept record ID from Salesforce
    @api recordId;
    @api objectApiName;

    connectedCallback() {
        // If record context is available, pass it to the RMS app
        if (this.recordId && this.objectApiName) {
            this.rmsUrl += `?recordId=${this.recordId}&objectType=${this.objectApiName}`;
        }

        console.log('🔗 RMS URL:', this.rmsUrl);

        // Listen for messages from the iframe (RMS app)
        window.addEventListener('message', this.handleMessage.bind(this));
        
        // Listen for iframe load errors
        this.setupIframeErrorHandling();
    }
    
    setupIframeErrorHandling() {
        // Wait for iframe to be rendered
        setTimeout(() => {
            const iframe = this.template.querySelector('.rms-iframe');
            if (iframe) {
                iframe.addEventListener('error', (event) => {
                    console.error('❌ Iframe load error:', event);
                    this.showNotification('Failed to load RMS app. Check console for details.', 'error');
                });
                
                iframe.addEventListener('load', () => {
                    console.log('✅ Iframe loaded successfully');
                    // Check if iframe content is accessible
                    try {
                        const iframeContent = iframe.contentDocument || iframe.contentWindow.document;
                        console.log('✅ Iframe content accessible');
                    } catch (e) {
                        console.warn('⚠️ Cannot access iframe content (likely CORS/Security):', e.message);
                        this.showNotification('RMS app loaded but content may be restricted. Check SSL certificate.', 'warning');
                    }
                });
            }
        }, 100);
    }

    disconnectedCallback() {
        window.removeEventListener('message', this.handleMessage.bind(this));
    }

    handleMessage(event) {
        // Handle messages from RMS app
        // Note: Messages from the RMS iframe will have origin 'https://rms.propelor.io'
        // Messages from Salesforce/Lightning will have Salesforce origins - we ignore those
        const allowedOrigins = [
            'https://rms.propelor.io',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://13.204.127.113:8080' // Legacy IP (for fallback)
        ];
        
        // Check if message is from RMS app (not from Salesforce itself)
        const isFromRMS = allowedOrigins.some(origin => {
            const originHost = origin.split('://')[1]?.split(':')[0];
            return event.origin.includes(originHost);
        });
        
        // Ignore messages from Salesforce (they're internal Lightning messages)
        if (event.origin.includes('salesforce.com') || event.origin.includes('force.com') || event.origin.includes('lightning.force.com')) {
            // This is Salesforce internal messaging, ignore it
            return;
        }
        
        if (!isFromRMS) {
            console.warn('Message from unauthorized origin (not RMS):', event.origin);
            return;
        }
        
        // Safely extract message data
        if (!event.data) {
            console.warn('⚠️ Received message with no data:', event);
            return;
        }
        
        const { type, data, message } = event.data;
        
        console.log('📨 Message received from RMS:', type, data || message);
        
        // Handle different message types from RMS app
        switch(type) {
            case 'RMS_READY':
                // RMS app has loaded successfully
                const readyMessage = data?.message || message || 'RMS App Connected';
                console.log('✅ RMS app is ready:', readyMessage);
                this.showNotification('RMS App Connected', 'success');
                break;
                
            case 'RMS_UPDATE':
                // Generic update from RMS
                this.handleRMSUpdate(data);
                break;
                
            case 'RATE_UPDATED':
            case 'RATE_CREATED':
                // Handle rate update/create notification
                this.showNotification('Rate updated successfully in RMS', 'success');
                // Optionally update Salesforce record
                if (data && data.recordId) {
                    this.updateSalesforceRecord(data);
                }
                break;
                
            case 'MARGIN_RULE_UPDATED':
                this.showNotification('Margin rule updated successfully', 'success');
                break;
                
            default:
                console.log('Unknown message type:', type);
        }
    }
    
    handleRMSUpdate(data) {
        // Handle generic updates from RMS
        console.log('RMS Update:', data);
        // Add your custom logic here
    }

    updateSalesforceRecord(data) {
        // Use Salesforce LWC to update records
        // Example: update record with rate data from RMS
        // You'll need to implement this based on your Salesforce object structure
        
        // Example using @wire(updateRecord):
        // import { updateRecord } from 'lightning/uiRecordApi';
        // 
        // const fields = {};
        // fields.Id = this.recordId;
        // fields.Rate__c = data.rate;
        // fields.Last_Updated__c = new Date().toISOString();
        // 
        // const recordInput = { fields };
        // updateRecord(recordInput)
        //     .then(() => {
        //         this.showNotification('Record updated successfully', 'success');
        //     })
        //     .catch(error => {
        //         this.showNotification('Error updating record: ' + error.body.message, 'error');
        //     });
    }

    showNotification(message, variant = 'info') {
        // Show Toast notification in Salesforce
        const evt = new ShowToastEvent({
            title: 'RMS Notification',
            message: message,
            variant: variant, // 'success', 'error', 'warning', 'info'
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }

    // Optional: Send data to RMS app
    sendDataToRMS(data) {
        const iframe = this.template.querySelector('.rms-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'SALESFORCE_DATA',
                data: data
            }, this.rmsUrl.split('?')[0]);
        }
    }
}

