package ru.fastgo.tsd;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class CoalescingTaskTest {
    private static final class QueueExecutor implements Executor {
        final Queue<Runnable> queue = new ArrayDeque<>();
        boolean rejectNext;
        int largestQueue;

        @Override public void execute(Runnable command) {
            if (rejectNext) {
                rejectNext = false;
                throw new RejectedExecutionException("test rejection");
            }
            queue.add(command);
            largestQueue = Math.max(largestQueue, queue.size());
        }

        void next() { queue.remove().run(); }
        void drain() { while (!queue.isEmpty()) next(); }
    }

    @Test public void previousPerScanSchedulingPutsOneHundredJobsAheadOfCancellation() {
        QueueExecutor executor = new QueueExecutor();
        List<String> calls = new ArrayList<>();
        for (int i = 0; i < 100; i++) executor.execute(() -> calls.add("sync"));
        executor.execute(() -> calls.add("cancel"));
        assertEquals(101, executor.queue.size());
        executor.drain();
        assertEquals("cancel", calls.get(100));
    }

    @Test public void oneHundredNotificationsKeepEveryPersistedScanButQueueOneSync() throws Exception {
        QueueExecutor executor = new QueueExecutor();
        JSONObject document = ScanDocument.create("receipt");
        int initialRevision = document.getInt("revision");
        JSONObject part = new JSONObject().put("id", "part-1").put("name", "Амортизатор");
        List<Integer> snapshots = new ArrayList<>();
        CoalescingTask task = new CoalescingTask(executor, () -> snapshots.add(ScanDocument.count(document)));
        for (int i = 0; i < 100; i++) {
            ScanDocument.append(document, "FGP-00000036", part);
            task.request();
        }
        assertEquals(100, ScanDocument.count(document));
        assertEquals(initialRevision + 100, document.getInt("revision"));
        assertEquals(1, executor.queue.size());
        String persisted = document.toString();
        executor.drain();
        assertEquals(Arrays.asList(100), snapshots);
        assertEquals(persisted, document.toString());
        assertEquals(100, ScanDocument.count(new JSONObject(persisted)));
        assertEquals(1, executor.largestQueue);
    }

    @Test public void requestsDuringRunProduceOneFollowUpBehindExplicitOperations() {
        QueueExecutor executor = new QueueExecutor();
        List<String> calls = new ArrayList<>();
        CoalescingTask[] task = new CoalescingTask[1];
        task[0] = new CoalescingTask(executor, () -> {
            calls.add("sync");
            if (calls.size() == 1) {
                executor.execute(() -> calls.add("cancel"));
                executor.execute(() -> calls.add("accept-receipt"));
                executor.execute(() -> calls.add("issue-parts"));
                for (int i = 0; i < 100; i++) task[0].request();
                assertEquals(3, executor.queue.size());
            }
        });
        task[0].request();
        executor.next();
        assertEquals(4, executor.queue.size());
        executor.drain();
        assertEquals(Arrays.asList("sync", "cancel", "accept-receipt", "issue-parts", "sync"), calls);
    }

    @Test public void scanPersistedDuringRunIsIncludedInFollowUp() throws Exception {
        QueueExecutor executor = new QueueExecutor();
        JSONObject document = ScanDocument.create("sale");
        JSONObject part = new JSONObject().put("id", "part-1").put("name", "Амортизатор");
        ScanDocument.append(document, "FGP-00000036", part);
        List<Integer> snapshots = new ArrayList<>();
        CoalescingTask[] task = new CoalescingTask[1];
        task[0] = new CoalescingTask(executor, () -> {
            snapshots.add(ScanDocument.count(document));
            if (snapshots.size() == 1) {
                try { ScanDocument.append(document, "FGP-00000036", part); }
                catch (Exception error) { throw new AssertionError(error); }
                task[0].request();
            }
        });
        task[0].request();
        executor.drain();
        assertEquals(Arrays.asList(1, 2), snapshots);
        assertEquals(2, ScanDocument.count(document));
        assertNotEquals(document.getJSONArray("events").getJSONObject(0).getString("id"),
                document.getJSONArray("events").getJSONObject(1).getString("id"));
    }

    @Test public void concurrentUiBurstWhileNetworkIsBlockedKeepsOneFollowUp() throws Exception {
        QueueExecutor executor = new QueueExecutor();
        CountDownLatch running = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        int[] calls = {0};
        CoalescingTask task = new CoalescingTask(executor, () -> {
            if (++calls[0] == 1) {
                running.countDown();
                try {
                    if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("Network fixture timeout");
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError(interrupted);
                }
            }
        });
        task.request();
        Thread worker = new Thread(executor::next);
        worker.start();
        try {
            assertTrue("Network task did not start", running.await(2, TimeUnit.SECONDS));
            for (int i = 0; i < 100; i++) task.request();
            assertTrue(executor.queue.isEmpty());
        } finally {
            release.countDown();
            worker.join(2000);
        }
        assertFalse("Network fixture did not finish", worker.isAlive());
        assertEquals(1, executor.queue.size());
        executor.drain();
        assertEquals(2, calls[0]);
        assertEquals(1, executor.largestQueue);
    }

    @Test public void exceptionRetainsRequestedFollowUpAndDoesNotWedgeLaterRequests() {
        QueueExecutor executor = new QueueExecutor();
        int[] calls = {0};
        CoalescingTask[] task = new CoalescingTask[1];
        task[0] = new CoalescingTask(executor, () -> {
            calls[0]++;
            if (calls[0] == 1) {
                task[0].request();
                throw new IllegalStateException("offline");
            }
        });
        task[0].request();
        try { executor.next(); fail("Expected simulated failure"); }
        catch (IllegalStateException expected) { assertEquals("offline", expected.getMessage()); }
        assertEquals(1, executor.queue.size());
        executor.drain();
        task[0].request();
        executor.drain();
        assertEquals(3, calls[0]);
    }

    @Test public void exceptionWithoutFollowUpAllowsAnotherRequest() {
        QueueExecutor executor = new QueueExecutor();
        int[] calls = {0};
        CoalescingTask task = new CoalescingTask(executor, () -> {
            if (++calls[0] == 1) throw new IllegalStateException("offline");
        });
        task.request();
        try { executor.next(); fail("Expected simulated failure"); }
        catch (IllegalStateException expected) { }
        task.request();
        executor.drain();
        assertEquals(2, calls[0]);
    }

    @Test public void rejectedSubmissionCanBeRetriedWithoutDuplicateWork() {
        QueueExecutor executor = new QueueExecutor();
        int[] calls = {0};
        CoalescingTask task = new CoalescingTask(executor, () -> calls[0]++);
        executor.rejectNext = true;
        task.request();
        assertEquals(0, executor.queue.size());
        for (int i = 0; i < 100; i++) task.request();
        executor.drain();
        assertEquals(1, calls[0]);
    }

    @Test public void closeSkipsQueuedAutomaticWorkButLeavesExplicitOperationsIntact() {
        QueueExecutor executor = new QueueExecutor();
        List<String> calls = new ArrayList<>();
        CoalescingTask task = new CoalescingTask(executor, () -> calls.add("sync"));
        task.request();
        executor.execute(() -> calls.add("cancel"));
        task.close();
        task.request();
        executor.drain();
        assertTrue(task.isClosed());
        assertEquals(Arrays.asList("cancel"), calls);
    }

    @Test public void closeDuringRunSuppressesFollowUp() {
        QueueExecutor executor = new QueueExecutor();
        int[] calls = {0};
        CoalescingTask[] task = new CoalescingTask[1];
        task[0] = new CoalescingTask(executor, () -> {
            calls[0]++;
            task[0].request();
            task[0].close();
            task[0].request();
        });
        task[0].request();
        executor.drain();
        assertEquals(1, calls[0]);
        assertTrue(executor.queue.isEmpty());
    }
}
