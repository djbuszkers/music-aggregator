import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getReleaseById } from "@/lib/db";
import { ShareButton } from "@/components/ShareButton";
import { getBandcampEmbedUrl } from "@/lib/bandcamp";

async function getRelease(id: string) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  return getReleaseById(numId);
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const release = await getRelease(params.id);

  if (!release) {
    return { title: "Release Not Found | OctoCrate" };
  }

  const title = `${release.artist} - ${release.title}`;
  const description = release.review_snippet
    ? release.review_snippet.substring(0, 155) + "..."
    : "Check out this release on OctoCrate";

  return {
    title: `${title} | OctoCrate`,
    description,
    openGraph: {
      title,
      description,
      type: "music.album",
      images: release.cover_image
        ? [
            {
              url: release.cover_image,
              width: 1200,
              height: 1200,
              alt: `${release.artist} - ${release.title} album cover`,
            },
          ]
        : [],
      siteName: "OctoCrate",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: release.cover_image ? [release.cover_image] : [],
    },
  };
}

export default async function ReleasePage({
  params,
}: {
  params: { id: string };
}) {
  const release = await getRelease(params.id);

  if (!release) {
    notFound();
  }

  const formattedDate = new Date(release.published_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center text-zinc-400 hover:text-white mb-6 transition-colors text-sm"
        >
          &larr; Back to all releases
        </Link>

        {/* Release header */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Cover image */}
          <div className="flex-shrink-0">
            {release.cover_image ? (
              <img
                src={release.cover_image}
                alt={`${release.artist} - ${release.title}`}
                className="w-full sm:w-[300px] aspect-square object-cover bg-zinc-800"
              />
            ) : (
              <div className="w-full sm:w-[300px] aspect-square bg-zinc-800 flex items-center justify-center">
                <span className="text-zinc-600 text-6xl">♪</span>
              </div>
            )}
          </div>

          {/* Release info */}
          <div className="flex flex-col justify-between py-1">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                  {release.artist}
                </h1>
                {release.release_type && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded ${
                    release.release_type === "Single" ? "bg-blue-900 text-blue-200" :
                    release.release_type === "EP" ? "bg-amber-900 text-amber-200" :
                    "bg-green-900 text-green-200"
                  }`}>
                    {release.release_type}
                  </span>
                )}
                {release.is_inky_tip ? (
                  <span className="px-2.5 py-1 text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white rounded">
                    🐙 INKY TIP
                  </span>
                ) : null}
              </div>
              <p className="text-xl text-zinc-400 mt-1">{release.title}</p>
              {release.inky_tip_note && (
                <p className="text-sm text-purple-300 mt-2 italic">&ldquo;{release.inky_tip_note}&rdquo;</p>
              )}
              {release.label && (
                <p className="text-sm text-zinc-500 mt-2">{release.label}</p>
              )}
              {release.genre && (
                <p className="text-sm text-zinc-500 mt-1">{release.genre}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              {release.spotify_url && (
                <a
                  href={release.spotify_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#1DB954] text-black rounded hover:bg-[#1ed760] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Spotify
                </a>
              )}
              {release.youtube_url && (
                <a
                  href={release.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#FF0000] text-white rounded hover:bg-[#cc0000] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube
                </a>
              )}
              <ShareButton
                releaseId={release.id}
                artist={release.artist}
                title={release.title}
              />
            </div>
          </div>
        </div>

        {/* Bandcamp Player */}
        {release.bandcamp_album_id && (
          <div className="mt-8 flex justify-center">
            <iframe
              style={{ border: 0, width: "350px", maxWidth: "100%", height: "120px" }}
              src={getBandcampEmbedUrl(release.bandcamp_album_id)}
              seamless
              allow="autoplay"
              title={`Bandcamp player for ${release.artist} - ${release.title}`}
            />
          </div>
        )}

        {/* Details section */}
        <div className="mt-8 bg-zinc-900 rounded-lg p-6">
          {release.review_snippet && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Review Excerpt
              </h2>
              <p className="text-zinc-300 leading-relaxed">
                {release.review_snippet}
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold text-zinc-400">Source:</span>{" "}
              <span className="text-zinc-300">{release.source_name}</span>
            </div>
            <div>
              <span className="font-semibold text-zinc-400">Published:</span>{" "}
              <span className="text-zinc-300">{formattedDate}</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-800">
            <a
              href={release.review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-black px-6 py-3 rounded-md hover:bg-zinc-200 transition-colors font-medium text-sm"
            >
              Read Full Review &rarr;
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
