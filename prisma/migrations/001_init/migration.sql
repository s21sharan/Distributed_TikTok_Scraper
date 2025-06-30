-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('PROFILE', 'VIDEO');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'ERROR');

-- CreateTable
CREATE TABLE "queue_items" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "QueueType" NOT NULL DEFAULT 'PROFILE',
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "videosFound" INTEGER,
    "videosProcessed" INTEGER,
    "workerId" TEXT,

    CONSTRAINT "queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'IDLE',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "currentTaskId" TEXT,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_results" (
    "id" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT,
    "totalVideos" INTEGER NOT NULL DEFAULT 0,
    "successfulVideos" INTEGER NOT NULL DEFAULT 0,
    "failedVideos" INTEGER NOT NULL DEFAULT 0,
    "csvFilePath" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingTime" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scraping_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_data" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "duration" TEXT,
    "uploadDate" TIMESTAMP(3),
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_stats" (
    "id" TEXT NOT NULL,
    "uptime" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workers_name_key" ON "workers"("name");

-- AddForeignKey
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraping_results" ADD CONSTRAINT "scraping_results_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "queue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_data" ADD CONSTRAINT "video_data_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "scraping_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 