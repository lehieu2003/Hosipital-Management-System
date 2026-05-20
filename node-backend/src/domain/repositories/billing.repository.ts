import { BillingQueries } from './billing/billing.queries.js';
import {
  BillingWorkflows,
  syncBillingSettlementForDischargeTx,
} from './billing/billing.workflows.js';

class BillingRepository {
  private readonly queries = new BillingQueries();
  private readonly workflows = new BillingWorkflows();

  findInvoiceByAdmissionId =
    this.queries.findInvoiceByAdmissionId.bind(this.queries);
  appendCharge = this.workflows.appendCharge.bind(this.workflows);
  recordPayment = this.workflows.recordPayment.bind(this.workflows);
  syncSettlementForDischarge =
    this.workflows.syncSettlementForDischarge.bind(this.workflows);
}

export const billingRepository = new BillingRepository();
export { syncBillingSettlementForDischargeTx };

export type {
  AppendChargeRecordInput,
  AppendChargeWriteResult,
  BillingActorRecord,
  BillingChargeReplayRecord,
  BillingInvoiceLineRecord,
  BillingInvoiceRecord,
  BillingInvoiceTransitionSnapshot,
  BillingPatientRecord,
  BillingPaymentRecord,
  BillingTransitionRecord,
  RecordPaymentInput,
  RecordPaymentWriteResult,
  SyncDischargeSettlementInput,
  SyncDischargeSettlementWriteResult,
} from './billing/billing.types.js';
