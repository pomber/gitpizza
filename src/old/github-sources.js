import * as fetchers from "./fetchers";
import { MissingValue } from "./utils/hitchcock";

const entryValue = e => (e.isTree ? "0" + e.name : "1" + e.name);
const entryComparer = (a, b) => entryValue(a).localeCompare(entryValue(b));
const mapEntries = (parentPath, entries) =>
  entries
    .map(entry => ({
      ...entry,
      byteSize: entry.object && entry.object.byteSize,
      isTree: entry.type === "tree",
      path: `${parentPath}${entry.name}${entry.type === "tree" ? "/" : ""}`
    }))
    .sort(entryComparer);

const getBranchName = boxId => `forkbox-${boxId}`;

const sources = {
  ghToken: () => ({
    hash: () => "gh-token",
    get: () => localStorage["gh-token"],
    fetch: cache => {
      const code = cache.getByKey("gh-code");
      if (code === undefined) {
        throw new MissingValue("gh-code");
      }
      return fetchers.getGhToken(code);
    },
    store: (token, cache) => {
      localStorage.setItem("gh-token", token);
    }
  }),
  tree: path => ({
    hash: () => "tree" + path,
    fetch: cache => {
      console.log("fetch", path);
      const token = cache.getFromSource(sources.ghToken());
      const repoId = cache.getByKey("repo").id;
      const entryId = cache.getByKey("entry" + path).sha;
      return fetchers.getTree({ token, repoId, entryId });
    },
    store: (ghEntries, cache) => {
      const entries = mapEntries(path, ghEntries);
      entries.forEach(entry => {
        cache.set("entry" + entry.path, entry);
      });
      cache.set("tree" + path, entries.map(entry => entry.path));
    },
    view: cache => {
      const paths = cache.getByKey("tree" + path);
      return paths.map(childPath => cache.getByKey("entry" + childPath));
    }
  }),
  blobText: path => ({
    hash: () => "text" + path,
    fetch: cache => {
      const token = cache.getFromSource(sources.ghToken());
      const repoId = cache.getByKey("repo").id;
      const entryId = cache.getByKey("entry" + path).sha;
      return fetchers.getBlobText({ token, repoId, entryId });
    },
    write: (text, cache) => {
      const token = cache.getFromSource(sources.ghToken());
      const { user, name, boxId } = cache.getByKey("repo");
      const sha = cache.getByKey("entry" + path).sha;
      fetchers
        .commitBlobText({
          token,
          user,
          repoName: name,
          branchName: getBranchName(boxId),
          path,
          text,
          sha
        })
        .then(({ sha, byteSize }) =>
          cache.set("entry" + path, {
            ...cache.getByKey("entry" + path),
            sha,
            byteSize
          })
        );
    }
  }),
  repo: (user, repoName, branch) => ({
    hash: () => "repo",
    fetch: cache => {
      console.log("fetch", repoName);
      const token = cache.getFromSource(sources.ghToken());
      return fetchers.getRepo({ token, user, repoName, branch });
    },
    store: (repoInfo, cache) => {
      const rootEntry = {
        path: "/",
        isTree: true,
        name: "",
        sha: repoInfo.object.sha,
        type: "tree"
      };
      const entries = mapEntries(rootEntry.path, repoInfo.object.entries);
      const repo = {
        id: repoInfo.id,
        user,
        name: repoName,
        branch,
        url: repoInfo.url
      };

      cache.set("repo", repo);
      cache.set("entry" + rootEntry.path, rootEntry);
      entries.forEach(entry => {
        cache.set("entry" + entry.path, entry);
      });
      cache.set("tree" + rootEntry.path, entries.map(entry => entry.path));
    },
    view: cache => {
      const { user, name, boxId, url } = cache.getByKey("repo");
      return {
        user,
        repoName: name,
        repoUrl: url,
        branchName: getBranchName(boxId),
        saveText: (path, text) => {
          if (text != null) {
            cache.write(sources.blobText(path), text);
          }
        }
      };
    }
  }),
  fork: (owner, repoName, branch) => ({
    hash: () => `fork-${owner}/${repoName}/${branch}`,
    fetch: cache => {
      const token = cache.getFromSource(sources.ghToken());
      fetchers.fork({ token, owner, repoName }).then(x => {
        console.log(x);
        const boxId = Date.now();
        const { user, name } = cache.getByKey("repo");
        const newBranch = getBranchName(boxId);
        fetcher.branch({ token });
      });
    }
  }),
  code: code => ({
    hash: () => "gh-code",
    fetch: cache => {
      return Promise.resolve();
    },
    store: cache => {
      cache.set("gh-code", code);
    }
  }),
  zeitCode: code => ({
    hash: () => "zeit-code",
    fetch: cache => {
      return Promise.resolve();
    },
    store: cache => {
      cache.set("zeit-code", code);
    }
  }),
  zeit: () => ({
    hash: () => "zeit",
    get: () => localStorage["zeit-token"],
    fetch: cache => {
      const code = cache.getByKey("zeit-code");
      if (code === undefined) {
        throw new MissingValue("zeit-code");
      }
      return fetchers.getZeitToken(code);
    },
    store: (token, cache) => {
      localStorage.setItem("zeit-token", token);
    },
    view: cache => dockerfile => {
      return fetchers.deployToZeit({
        token: localStorage["zeit-token"],
        repoName: cache.getByKey("repo").name,
        dockerfile
      });
    }
  })
};

export default sources;