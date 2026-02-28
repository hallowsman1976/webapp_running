// utils/lineHelper.gs
// Push message, Flex Message via LINE Messaging API

const LineHelper = {

  getAccessToken() {
    const token = PropertiesService.getScriptProperties()
      .getProperty('LINE_OA_BOT_ACCESS_TOKEN');
    if (!token) throw new Error('LINE_OA_BOT_ACCESS_TOKEN not configured');
    return token;
  },

  /**
   * Push text message ไปหา user
   */
  pushMessage(userId, text) {
    return this._pushMessages(userId, [{ type: 'text', text }]);
  },

  /**
   * Push Flex Message ไปหา user
   */
  pushFlex(userId, altText, flexContents) {
    return this._pushMessages(userId, [{
      type: 'flex',
      altText,
      contents: flexContents
    }]);
  },

  _pushMessages(to, messages) {
    try {
      const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAccessToken()}`
        },
        payload: JSON.stringify({ to, messages }),
        muteHttpExceptions: true
      });

      const code = res.getResponseCode();
      if (code !== 200) {
        console.error('LINE push failed:', res.getContentText());
        return false;
      }
      return true;
    } catch (err) {
      console.error('LINE push error:', err.message);
      return false;
    }
  },

  /**
   * สร้าง BIB Card Flex Message
   */
  buildBibFlexMessage(reg, event, distance, user) {
    const statusColor = reg.checkinStatus === 'checked' ? '#00C851' : '#FF8800';
    const statusText = reg.checkinStatus === 'checked' ? '✅ เช็คอินแล้ว' : '⏳ ยังไม่เช็คอิน';

    return {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: event.coverImageUrl || 'https://via.placeholder.com/800x400?text=Runner+Event',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: event.eventName,
            weight: 'bold',
            size: 'lg',
            wrap: true,
            color: '#1a1a2e'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '📅', size: 'sm', flex: 0 },
              { type: 'text', text: formatDateThai(event.eventDate), size: 'sm', color: '#555', margin: 'sm' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '📍', size: 'sm', flex: 0 },
              { type: 'text', text: event.eventLocation, size: 'sm', color: '#555', margin: 'sm', wrap: true }
            ]
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f0f4ff',
            cornerRadius: 'md',
            paddingAll: 'md',
            margin: 'md',
            contents: [
              { type: 'text', text: 'หมายเลข BIB', size: 'xs', color: '#888' },
              { type: 'text', text: reg.bibNumber, size: 'xxl', weight: 'bold', color: '#1a1a2e' },
              { type: 'text', text: distance.distanceName, size: 'sm', color: '#4A90D9' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'ชื่อ', size: 'xs', color: '#888' },
                  { type: 'text', text: `${reg.firstName} ${reg.lastName}`, size: 'sm', weight: 'bold', wrap: true }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'เสื้อ', size: 'xs', color: '#888' },
                  { type: 'text', text: reg.shirtSize || '-', size: 'sm', weight: 'bold' }
                ]
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: statusColor + '22',
            cornerRadius: 'md',
            paddingAll: 'sm',
            margin: 'sm',
            contents: [
              { type: 'text', text: statusText, size: 'sm', weight: 'bold', color: statusColor, align: 'center' }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#4A90D9',
            action: {
              type: 'uri',
              label: '🎫 ดู BIB Card',
              uri: `${PropertiesService.getScriptProperties().getProperty('LIFF_BASE_URL')}/bib?regId=${reg.registrationId}`
            }
          }
        ]
      }
    };
  }
};

function formatDateThai(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
