import { format, formatDistanceToNow, differenceInHours } from 'date-fns';

/**
 * Formats RFQ details into a professional, corporate text message for Viber/Messaging.
 * Corporate format with formal tone and structured information.
 */
export function formatRfqForViber(
  rfq: any,
  pr1: any,
  items: any[],
  supplierAssignmentId?: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  
  // Format deadline
  let deadlineStr = 'No deadline specified';
  let isUrgent = false;
  
  if (rfq.deadline) {
    const deadlineDate = new Date(rfq.deadline);
    const hoursRemaining = differenceInHours(deadlineDate, new Date());
    isUrgent = hoursRemaining < 48 && hoursRemaining > 0;
    
    deadlineStr = format(deadlineDate, 'MMMM d, yyyy');
    
    // Add time if available
    if (rfq.deadline_time) {
      deadlineStr += ` at ${rfq.deadline_time}`;
    }
  }
  
  // Format issue date
  const issuedStr = format(new Date(rfq.created_at || Date.now()), 'MMMM d, yyyy');
  
  // Build corporate message
  let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 REQUEST FOR QUOTATION\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  text += `RFQ NUMBER:\n${rfq.rfq_number}\n\n`;
  text += `DEPARTMENT:\n${pr1.department_name_snapshot || 'Unspecified'}\n\n`;
  text += `PROJECT/PURPOSE:\n${pr1.purpose || 'General procurement'}\n\n`;
  text += `DATE ISSUED:\n${issuedStr}\n\n`;
  text += `DEADLINE FOR SUBMISSION:\n${deadlineStr}\n`;
  
  if (isUrgent) {
    text += `⚠️ URGENT - Immediate response required\n`;
  }
  
  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `ITEMS REQUESTED\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  items.slice(0, 10).forEach((item, idx) => {
    const unit = item.unit_of_measure || 'unit';
    text += `${idx + 1}. ${item.description}\n`;
    text += `   Quantity: ${item.quantity_requested} ${unit}\n\n`;
  });
  
  if (items.length > 10) {
    text += `...and ${items.length - 10} additional item${items.length - 10 !== 1 ? 's' : ''}\n\n`;
  }
  
  text += `TOTAL LINE ITEMS: ${items.length}\n\n`;
  
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `SUBMISSION INSTRUCTIONS\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (supplierAssignmentId) {
    text += `To submit your quotation, please access:\n\n`;
    text += `${appUrl}/supplier/quotations/${supplierAssignmentId}\n\n`;
  } else {
    text += `To view and respond to this RFQ:\n\n`;
    text += `${appUrl}/login\n\n`;
  }
  
  text += `Please ensure your quotation includes:\n`;
  text += `• Unit prices for all items\n`;
  text += `• Lead time/delivery schedule\n`;
  text += `• Terms and conditions\n`;
  text += `• Validity period of quotation\n\n`;
  
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `⚠️ IMPORTANT NOTICE\n`;
  text += `Late submissions will not be considered.\n`;
  text += `Incomplete quotations may be disqualified.\n\n`;
  
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `This is an automated message.\n`;
  text += `Please do not reply to this notification.`;

  return text;
}
