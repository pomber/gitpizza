import gql from "./utils/gql";

export const getRepo = ({ token, owner, repoName, branch }) => gql`
  ${token}
  ${{ owner, repoName, branchExpression: branch + ":" }}
  ${({ owner }) => owner.repository}
  query($owner: String!, $repoName: String!, $branchExpression: String!) {
    owner: repositoryOwner(login: $owner) {
      repository(name: $repoName) {
        id
        url
        object(expression: $branchExpression) {
          sha: oid
          ... on Tree {
            entries {
              sha: oid
              name
              type
              object {
                ... on Blob {
                  byteSize
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const getTree = ({ token, repoId, entrySha }) => gql`
  ${token}
  ${{ repoId, entrySha }}
  ${({ repository }) => repository.object.entries}
  query($repoId: ID!, $entrySha: GitObjectID!) {
    repository: node(id: $repoId) {
      ... on Repository {
        object(oid: $entrySha) {
          ... on Tree {
            entries {
              sha: oid
              name
              type
              object {
                ... on Blob {
                  byteSize
                }
              }
            }
          }
        }
      }
    }
  }
`;