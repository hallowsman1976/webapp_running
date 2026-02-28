// src/utils/flexMessage.ts
// Flex Message builder สำหรับ BIB Card, Event Share, Check-in Confirm

import type { Registration, Event, EventDistance } from '../types';
import { DateHelper } from './dateHelper';

export const FlexBuilder = {

  // ─────────────────────────────────────────────────────────
  // BIB Card Flex Message (สำหรับ shareTargetPicker)
  // ─────────────────────────────────────────────────────────
  bibCard(
    reg: Registration,
    event: Event,
    distance: EventDistance,
    liffBaseUrl: string
  ): object {
    const isApproved = reg.status === 'approved';
    const isChecked  = reg.checkinStatus === 'checked';

    const statusColor = isChecked  ? '#00C851' :
                        isApproved ? '#4A90D9' : '#FF8800';
    const statusIcon  = isChecked  ? '✅' :
                        isApproved ? '🎫' : '⏳';
    const statusText  = isChecked  ? 'เช็คอินแล้ว' :
                        isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ';

    const heroImageUrl = event.coverImageUrl ||
      'https://via.placeholder.com/800x400/1a1a2e/ffffff?text=Runner+Event';

    return {
      type: 'bubble',
      size: 'mega',

      // ── Hero Image (รูปงานวิ่ง) ───────────────────────────
      hero: {
        type:        'image',
        url:         heroImageUrl,
        size:        'full',
        aspectRatio: '20:13',
        aspectMode:  'cover',
        action: {
          type: 'uri',
          label: 'ดูรายละเอียด',
          uri: `${liffBaseUrl}?page=bib&regId=${reg.registrationId}`
        }
      },

      // ── Body ─────────────────────────────────────────────
      body: {
        type:    'box',
        layout:  'vertical',
        spacing: 'md',
        paddingAll: 'xl',
        contents: [
          // Event name
          {
            type:   'text',
            text:   event.eventName,
            weight: 'bold',
            size:   'lg',
            wrap:   true,
            color:  '#1a1a2e'
          },
          // Date + Location
          {
            type:    'box',
            layout:  'vertical',
            spacing: 'xs',
            margin:  'sm',
            contents: [
              {
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '📅', size: 'xs', flex: 0 },
                  { type: 'text', text: DateHelper.formatThai(event.eventDate),
                    size: 'xs', color: '#666666', flex: 1 }
                ]
              },
              {
                type: 'box', layout: 'horizontal', spacing: 'sm',
                contents: [
                  { type: 'text', text: '📍', size: 'xs', flex: 0 },
                  { type: 'text', text: event.eventLocation,
                    size: 'xs', color: '#666666', flex: 1, wrap: true }
                ]
              }
            ]
          },

          { type: 'separator', margin: 'lg' },

          // BIB Card box
          {
            type:            'box',
            layout:          'vertical',
            margin:          'lg',
            backgroundColor: '#f0f4ff',
            cornerRadius:    'xl',
            paddingAll:      'xl',
            contents: [
              {
                type:    'box',
                layout:  'horizontal',
                contents: [
                  {
                    type:   'box',
                    layout: 'vertical',
                    flex:   1,
                    contents: [
                      { type: 'text', text: 'BIB NUMBER',
                        size: 'xxs', color: '#999999',
                        weight: 'bold', letterSpacing: '2px' },
                      { type: 'text', text: reg.bibNumber,
                        size: 'xxxl', weight: 'bold',
                        color: '#1a1a2e', margin: 'xs' },
                      { type: 'text', text: distance.distanceName,
                        size: 'sm', color: '#4A90D9', weight: 'bold' }
                    ]
                  },
                  // Status badge
                  {
                    type:            'box',
                    layout:          'vertical',
                    flex:            0,
                    backgroundColor: statusColor + '22',
                    cornerRadius:    'md',
                    paddingAll:      'sm',
                    justifyContent:  'center',
                    contents: [
                      { type: 'text', text: statusIcon, size: 'xl',
                        align: 'center' },
                      { type: 'text', text: statusText, size: 'xxs',
                        color: statusColor, weight: 'bold', align: 'center' }
                    ]
                  }
                ]
              }
            ]
          },

          // Runner info
          {
            type:    'box',
            layout:  'horizontal',
            margin:  'lg',
            spacing: 'md',
            contents: [
              {
                type:   'box', layout: 'vertical', flex: 1,
                contents: [
                  { type: 'text', text: 'ชื่อ', size: 'xxs', color: '#999999' },
                  { type: 'text', text: `${reg.firstName} ${reg.lastName}`,
                    size: 'sm', weight: 'bold', color: '#1a1a2e', wrap: true }
                ]
              },
              {
                type:   'box', layout: 'vertical', flex: 0,
                contents: [
                  { type: 'text', text: 'เสื้อ', size: 'xxs', color: '#999999' },
                  { type: 'text', text: reg.shirtSize,
                    size: 'sm', weight: 'bold', color: '#1a1a2e' }
                ]
              }
            ]
          }
        ]
      },

      // ── Footer ───────────────────────────────────────────
      footer: {
        type:       'box',
        layout:     'vertical',
        spacing:    'sm',
        paddingAll: 'xl',
        contents: [
          {
            type:   'button',
            style:  'primary',
            color:  '#06C755',
            height: 'md',
            action: {
              type:  'uri',
              label: `🎫 ดู BIB Card ของฉัน`,
              uri:   `${liffBaseUrl}?page=bib&regId=${reg.registrationId}`
            }
          },
          {
            type:  'text',
            text:  'Runner Event Mini App',
            size:  'xxs',
            color: '#AAAAAA',
            align: 'center',
            margin: 'sm'
          }
        ]
      }
    };
  },

  // ─────────────────────────────────────────────────────────
  // Event Promotion Flex (แชร์งานวิ่งชวนเพื่อน)
  // ─────────────────────────────────────────────────────────
  eventPromo(
    event: Event,
    distances: EventDistance[],
    liffBaseUrl: string
  ): object {
    const minPrice = distances.length
      ? Math.min(...distances.map(d => Number(d.price))) : 0;
    const daysLeft = DateHelper.daysUntil(event.registrationCloseAt);
    const isOpen   = DateHelper.isRegistrationOpen(
      event.registrationOpenAt, event.registrationCloseAt);

    return {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url:  event.coverImageUrl || 'https://via.placeholder.com/800x400/1a1a2e/ffffff?text=🏃',
        size: 'full', aspectRatio: '20:13', aspectMode: 'cover',
        action: { type: 'uri', label: 'ดูงาน',
                  uri: `${liffBaseUrl}?page=event&eventId=${event.eventId}` }
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'xl',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              {
                type: 'text', text: isOpen ? '🟢 เปิดรับสมัคร' : '⏸ ปิดรับสมัคร',
                size: 'xs', color: isOpen ? '#00B900' : '#999999',
                weight: 'bold', flex: 0
              },
              { type: 'filler' },
              ...(isOpen && daysLeft > 0 ? [{
                type: 'text', text: `⚡ ${daysLeft} วันสุดท้าย`,
                size: 'xs', color: '#FF6B35', weight: 'bold', flex: 0
              }] : [])
            ]
          },
          { type: 'text', text: event.eventName, weight: 'bold',
            size: 'xl', wrap: true, color: '#1a1a2e' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'sm',
            contents: [
              { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                  { type: 'text', text: '📅', size: 'sm', flex: 0 },
                  { type: 'text', text: DateHelper.formatThai(event.eventDate),
                    size: 'sm', color: '#555555' }
              ]},
              { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                  { type: 'text', text: '📍', size: 'sm', flex: 0 },
                  { type: 'text', text: event.eventLocation,
                    size: 'sm', color: '#555555', wrap: true }
              ]}
            ]
          },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box', layout: 'horizontal', margin: 'lg',
            contents: distances.slice(0, 4).map(d => ({
              type: 'box', layout: 'vertical', flex: 1,
              backgroundColor: '#f0f4ff', cornerRadius: 'md', paddingAll: 'sm',
              contents: [
                { type: 'text', text: d.distanceName, size: 'sm',
                  weight: 'bold', color: '#4A90D9', align: 'center' },
                { type: 'text', text: `฿${Number(d.price).toLocaleString()}`,
                  size: 'xs', color: '#FF6B35', align: 'center', weight: 'bold' }
              ]
            }))
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'xl',
        contents: [{
          type: 'button', style: 'primary', color: '#1a1a2e',
          action: {
            type: 'uri', label: `🏃 สมัครเลย ${minPrice > 0 ? `฿${minPrice.toLocaleString()}` : 'ฟรี!'}`,
            uri: `${liffBaseUrl}?page=event&eventId=${event.eventId}`
          }
        }]
      }
    };
  },

  // ─────────────────────────────────────────────────────────
  // Checkin Confirm Flex (push ให้ runner หลัง checkin)
  // ─────────────────────────────────────────────────────────
  checkinConfirm(
    reg: Registration,
    event: Event,
    checkpointName: string,
    checkinTime: Date
  ): object {
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'vertical',
        paddingAll: 'xl', spacing: 'md',
        backgroundColor: '#f0fff4',
        contents: [
          { type: 'text', text: '✅', size: 'xxl', align: 'center' },
          { type: 'text', text: 'เช็คอินสำเร็จ!', weight: 'bold',
            size: 'xl', align: 'center', color: '#00C851' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md',
            contents: [
              this._infoRow('งานวิ่ง', event.eventName),
              this._infoRow('BIB', reg.bibNumber),
              this._infoRow('จุดเช็คอิน', checkpointName),
              this._infoRow('เวลา', DateHelper.formatTime(checkinTime)),
              this._infoRow('วันที่', DateHelper.formatThai(checkinTime))
            ]
          },
          {
            type: 'box', layout: 'vertical', margin: 'xl',
            backgroundColor: '#00C85122', cornerRadius: 'md', paddingAll: 'md',
            contents: [{
              type: 'text',
              text: '🏃 ขอให้โชคดีในการแข่งขัน!',
              align: 'center', color: '#00C851', weight: 'bold', size: 'sm'
            }]
          }
        ]
      }
    };
  },

  // ─────────────────────────────────────────────────────────
  // Approval Notification Flex
  // ─────────────────────────────────────────────────────────
  approvalNotify(
    reg: Registration,
    event: Event,
    distance: EventDistance,
    liffBaseUrl: string
  ): object {
    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'vertical',
        paddingAll: 'xl', spacing: 'md',
        contents: [
          { type: 'text', text: '🎉', size: 'xxl', align: 'center' },
          { type: 'text', text: 'การสมัครได้รับการอนุมัติแล้ว!',
            weight: 'bold', size: 'md', align: 'center', color: '#1a1a2e', wrap: true },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md',
            contents: [
              this._infoRow('งานวิ่ง', event.eventName),
              this._infoRow('ระยะทาง', distance.distanceName),
              this._infoRow('BIB', reg.bibNumber),
              this._infoRow('วันแข่ง', DateHelper.formatThai(event.eventDate))
            ]
          }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'lg',
        contents: [{
          type: 'button', style: 'primary', color: '#06C755',
          action: {
            type: 'uri', label: '🎫 ดู BIB Card',
            uri: `${liffBaseUrl}?page=bib&regId=${reg.registrationId}`
          }
        }]
      }
    };
  },

  // ─────────────────────────────────────────────────────────
  // Helper: Info Row
  // ─────────────────────────────────────────────────────────
  _infoRow(label: string, value: string): object {
    return {
      type: 'box', layout: 'horizontal',
      contents: [
        { type: 'text', text: label, size: 'xs', color: '#999999', flex: 2 },
        { type: 'text', text: value, size: 'xs', weight: 'bold',
          color: '#1a1a2e', flex: 3, wrap: true }
      ]
    };
  }
};
