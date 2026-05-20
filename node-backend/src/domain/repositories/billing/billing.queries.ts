import { db } from '../../../infrastructure/database/client.js';
import { wrapBillingStoreError } from './billing.errors.js';
import { invoiceSelect } from './billing.select.js';
import type { BillingInvoiceRecord } from './billing.types.js';

export class BillingQueries {
  async findInvoiceByAdmissionId(admissionId: string) {
    try {
      const invoice = await db.billingInvoice.findUnique({
        where: { admissionId },
        select: invoiceSelect,
      });

      return invoice as BillingInvoiceRecord | null;
    } catch (error) {
      return wrapBillingStoreError('find_invoice_by_admission_id', error, {
        admissionId,
      });
    }
  }
}
