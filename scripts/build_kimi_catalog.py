"""Initialize pgvector storage, or explicitly build paid public catalog embeddings."""
import argparse
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / '.env', encoding='utf-8-sig')


def fetch_policies(urls, fetcher=None):
    from agent_service.web_tools import OfficialSearchTools
    fetcher = fetcher or OfficialSearchTools()
    pages = []
    for url in urls:
        try:
            page = fetcher.fetch({'url': url, 'title': 'SJSU policy'}, time.monotonic() + 30)
            if not page.get('text', '').strip():
                raise ValueError('Empty policy text')
            pages.append(page)
            print(f"Fetched policy: {url} ({len(page['text'])} characters)")
        except Exception as exc:
            print(f'Policy fetch failed: {url}: {exc}')
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument('--embed', action='store_true', help='Authorize paid OpenAI embedding calls')
    operation.add_argument('--initialize', action='store_true', help='Initialize transcript and pgvector tables without embedding calls')
    parser.add_argument('--policy-url', action='append', default=[], help='Official SJSU policy URL to fetch and index')
    args = parser.parse_args()
    pages = fetch_policies(args.policy_url) if args.embed else []
    if args.policy_url and args.embed and not pages:
        raise SystemExit('No nonempty policy pages fetched. Nothing was indexed.')
    from agent_service.catalog_rag import catalog_rows, catalog_nodes, retrieval_index, vector_store
    from agent_service.transcripts import TranscriptStore
    TranscriptStore().initialize()
    for table in ('kimi_catalog', 'kimi_transcripts'):
        vector_store(table, setup=True).get_nodes(node_ids=['__initialize__'])
    if args.initialize:
        print('Initialized transcript and pgvector tables. No embedding calls made.')
        return
    rows = catalog_rows()
    if not rows:
        raise SystemExit('No imported catalog rows. Import the catalog before building its index.')
    nodes = catalog_nodes(rows, pages)
    index = retrieval_index('kimi_catalog', setup=True)
    # Stable IDs make re-indexing replace catalog nodes instead of duplicating them.
    for offset in range(0, len(nodes), 64):
        batch = nodes[offset:offset + 64]
        index.delete_nodes([n.node_id for n in batch])
        index.insert_nodes(batch)
        print(f'Indexed {min(offset + 64, len(nodes))}/{len(nodes)} public catalog nodes')
    print('Transcript storage initialized; no transcript content was read.')


if __name__ == '__main__':
    main()
