import AwaitLock from "await-lock";

export class LogseqReversibleTransactionOperationLockManager {
    private static readonly lock = new AwaitLock();

    public static async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
        await LogseqReversibleTransactionOperationLockManager.lock.acquireAsync();
        try {
            return await operation();
        } finally {
            LogseqReversibleTransactionOperationLockManager.lock.release();
        }
    }
}
