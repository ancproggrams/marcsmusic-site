-- CreateEnum
CREATE TYPE "CommentIntent" AS ENUM ('PRAISE', 'FEEDBACK', 'COLLAB_REQUEST', 'PLAYLIST_OR_BLOG', 'QUESTION', 'SPAM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ExperimentDecision" AS ENUM ('WON', 'LOST', 'INCONCLUSIVE', 'CONTINUE', 'NOT_REVIEWED');

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "soundcloudUrn" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "permalinkUrl" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoundCloudToken" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoundCloudToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "soundcloudUrn" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "permalinkUrl" TEXT NOT NULL,
    "genre" TEXT,
    "tags" TEXT[],
    "durationMs" INTEGER,
    "releaseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTrackMetric" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "followersDelta" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTrackMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "soundcloudCommentId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "authorUrn" TEXT NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "timestampMs" INTEGER,
    "sentiment" "Sentiment" NOT NULL DEFAULT 'UNKNOWN',
    "intent" "CommentIntent" NOT NULL DEFAULT 'UNKNOWN',
    "needsReply" BOOLEAN NOT NULL DEFAULT true,
    "replyDraft" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL,
    "soundcloudUrn" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "followerStatus" TEXT,
    "fanScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "variantA" TEXT NOT NULL,
    "variantB" TEXT,
    "primaryMetric" TEXT NOT NULL,
    "result" TEXT,
    "decision" "ExperimentDecision" NOT NULL DEFAULT 'NOT_REVIEWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Smartlink" (
    "id" TEXT NOT NULL,
    "trackId" TEXT,
    "slug" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "source" TEXT,
    "campaign" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Smartlink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_soundcloudUrn_key" ON "Artist"("soundcloudUrn");

-- CreateIndex
CREATE UNIQUE INDEX "SoundCloudToken_artistId_key" ON "SoundCloudToken"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_soundcloudUrn_key" ON "Track"("soundcloudUrn");

-- CreateIndex
CREATE INDEX "Track_artistId_idx" ON "Track"("artistId");

-- CreateIndex
CREATE INDEX "Track_releaseDate_idx" ON "Track"("releaseDate");

-- CreateIndex
CREATE INDEX "DailyTrackMetric_date_idx" ON "DailyTrackMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrackMetric_trackId_date_key" ON "DailyTrackMetric"("trackId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_soundcloudCommentId_key" ON "Comment"("soundcloudCommentId");

-- CreateIndex
CREATE INDEX "Comment_trackId_idx" ON "Comment"("trackId");

-- CreateIndex
CREATE INDEX "Comment_authorUrn_idx" ON "Comment"("authorUrn");

-- CreateIndex
CREATE INDEX "Comment_needsReply_idx" ON "Comment"("needsReply");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_soundcloudUrn_key" ON "Fan"("soundcloudUrn");

-- CreateIndex
CREATE INDEX "Experiment_startDate_idx" ON "Experiment"("startDate");

-- CreateIndex
CREATE INDEX "Experiment_trackId_idx" ON "Experiment"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "Smartlink_slug_key" ON "Smartlink"("slug");

-- CreateIndex
CREATE INDEX "Smartlink_campaign_idx" ON "Smartlink"("campaign");

-- CreateIndex
CREATE INDEX "Smartlink_source_idx" ON "Smartlink"("source");

-- AddForeignKey
ALTER TABLE "SoundCloudToken" ADD CONSTRAINT "SoundCloudToken_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrackMetric" ADD CONSTRAINT "DailyTrackMetric_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Smartlink" ADD CONSTRAINT "Smartlink_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
