package ru.fastgo.tsd;

import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

/** Coalesces notifications to read already-persisted state, never business operations. */
final class CoalescingTask {
    private final Executor executor;
    private final Runnable work;
    private boolean active;
    private boolean requested;
    private boolean closed;

    CoalescingTask(Executor executor, Runnable work) {
        this.executor = executor;
        this.work = work;
    }

    void request() {
        synchronized (this) {
            if (closed) return;
            requested = true;
            if (active) return;
            active = true;
        }
        submit();
    }

    private void submit() {
        try {
            executor.execute(this::run);
        } catch (RejectedExecutionException rejected) {
            // Leave the request pending: a later request can retry a temporary rejection.
            synchronized (this) {
                active = false;
            }
        }
    }

    private void run() {
        synchronized (this) {
            if (closed) {
                active = false;
                return;
            }
            requested = false;
        }
        try {
            work.run();
        } finally {
            boolean repeat;
            synchronized (this) {
                repeat = !closed && requested;
                if (!repeat) active = false;
            }
            // Queue at the tail so an explicit cancel/receipt/issue is not starved.
            if (repeat) submit();
        }
    }

    synchronized void close() {
        closed = true;
        requested = false;
    }

    synchronized boolean isClosed() {
        return closed;
    }
}
