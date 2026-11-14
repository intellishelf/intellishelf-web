import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Grid3x3, List, Filter, X } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import BookCard from '@/components/BookCard';
import BooksGridSkeleton from '@/components/books/BooksGridSkeleton';
import EmptyState from '@/components/books/EmptyState';
import SearchEmptyState from '@/components/SearchEmptyState';
import BooksPagination from '@/components/books/BooksPagination';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBooks } from '@/hooks/books/useBooks';
import { useSearchBooks } from '@/hooks/books/useSearchBooks';
import { useDebounce } from '@/hooks/utils/useDebounce';
import { useAuth } from '@/hooks/auth/useAuth';
import api, { ApiError } from '@/lib/api';
import { ReadingStatus, BookOrderBy, type Book } from '@/types/book';

type ExploreResult = { items: Book[]; truncated: boolean };
type Snapshot = { userId: string; prompt: string; page: number; pageSize: number; submitId: string | null; status: ReadingStatus | null; view: 'grid' | 'list'; frozen: { items: Book[]; totalCount: number; totalPages: number } };
// History state holds only an opaque key; prompts and results disappear on reload.
const entries = new Map<string, Snapshot>();
const examples = ['Books about how knowledge grows', 'Stories of loneliness and isolation', 'What do I own about scientific explanations?', 'Books similar to The Beginning of Infinity'];

const Library = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = (location.state as { libraryKey?: string } | null)?.libraryKey;
  const candidate = key ? entries.get(key) : undefined;
  const saved = candidate?.userId === user?.id ? candidate : undefined;
  const [entryKey, setEntryKey] = useState(key && saved ? key : '');
  const [aiMode, setAiMode] = useState(!!saved);
  const [searchQuery, setSearchQuery] = useState(saved?.prompt ?? params.get('search') ?? '');
  const [keyword, setKeyword] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounce(keyword, 300);
  const [status, setStatus] = useState<ReadingStatus | null>(saved?.status ?? (params.has('status') ? Number(params.get('status')) as ReadingStatus : null));
  const [page, setPage] = useState(saved?.page ?? Number(params.get('page') || 1));
  const [pageSize, setPageSize] = useState(saved?.pageSize ?? Number(params.get('pageSize') || 24));
  const [view, setView] = useState<'grid' | 'list'>(saved?.view ?? 'grid');
  const [submitId, setSubmitId] = useState<string | null>(saved?.submitId ?? null);
  const [frozen, setFrozen] = useState<Snapshot['frozen']>(saved?.frozen ?? { items: [], totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [validation, setValidation] = useState('');
  const [showPro, setShowPro] = useState(false);
  const requestId = useRef(0);
  const [result, setResult] = useState<ExploreResult | undefined>(() => saved?.submitId ? queryClient.getQueryData(['explore', saved.submitId]) : undefined);
  const hasFilter = !!debouncedSearch.trim() || status !== null;
  const { data: searchData, isLoading: searching } = useSearchBooks({ searchTerm: debouncedSearch, status, page, pageSize }, !aiMode);
  const { data: allBooks, isLoading: loadingAll } = useBooks({ page, pageSize, orderBy: BookOrderBy.Added, ascending: false }, !aiMode);
  const ordinary = hasFilter ? searchData : allBooks;
  const shown = aiMode ? frozen : ordinary;
  const items = aiMode && submitId ? result?.items.slice((page - 1) * pageSize, page * pageSize) : shown?.items;
  const count = aiMode && submitId ? result?.items.length : shown?.totalCount;
  const pages = aiMode && submitId ? Math.ceil((count ?? 0) / pageSize) : shown?.totalPages;
  const isLoading = aiMode ? loading : hasFilter ? searching : loadingAll;

  useEffect(() => {
    if (aiMode) {
      const clean: Record<string, string> = {};
      if (status !== null) clean.status = String(status);
      setParams(clean, { replace: true, state: { libraryKey: entryKey } });
      if (entryKey) entries.set(entryKey, { userId: user?.id ?? '', prompt: searchQuery, page, pageSize, submitId, status, view, frozen });
    } else {
      const next: Record<string, string> = {};
      if (debouncedSearch) next.search = debouncedSearch;
      if (status !== null) next.status = String(status);
      if (page !== 1) next.page = String(page);
      if (pageSize !== 24) next.pageSize = String(pageSize);
      setParams(next, { replace: true });
    }
  }, [aiMode, debouncedSearch, status, page, pageSize, setParams, entryKey, searchQuery, submitId, view, frozen, user?.id]);

  const submit = async (prompt: string) => {
    if (!prompt.trim() || allBooks?.totalCount === 0) return;
    if (prompt.length > 500) { setValidation('Please enter 500 characters or fewer.'); return; }
    setValidation(''); setFailed(false); setLoading(true); setPage(1);
    const id = crypto.randomUUID();
    const sequence = ++requestId.current;
    setSubmitId(id); setResult(undefined);
    try {
      const data = await queryClient.fetchQuery({ queryKey: ['explore', id], queryFn: () => api.post<ExploreResult>('/books/explore', { prompt: prompt.trim() }), retry: false, staleTime: Infinity, gcTime: Infinity });
      if (sequence === requestId.current) setResult(data);
    } catch (error) {
      if (sequence !== requestId.current) return;
      if (error instanceof ApiError && error.status === 403 && error.type === 'Explore.ProRequired') {
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        setAiMode(false); setShowPro(true);
      } else setFailed(true);
    } finally { if (sequence === requestId.current) setLoading(false); }
  };
  const activate = (run = false) => {
    if (!user?.isPro) { setShowPro(true); return; }
    const newKey = crypto.randomUUID();
    setEntryKey(newKey); setFrozen({ items: ordinary?.items ?? [], totalCount: ordinary?.totalCount ?? 0, totalPages: ordinary?.totalPages ?? 0 });
    setAiMode(true); setShowPro(false); setSubmitId(null); setResult(undefined); setFailed(false);
    navigate({ pathname: location.pathname, search: status === null ? '' : `?status=${status}` }, { replace: true, state: { libraryKey: newKey } });
    if (run) void submit(searchQuery);
  };
  const deactivate = () => { ++requestId.current; setLoading(false); setAiMode(false); setKeyword(searchQuery); setPage(1); setFailed(false); setValidation(''); if (entryKey) entries.delete(entryKey); };
  const updateResult = (items: Book[]) => {
    if (!result || !submitId) return;
    const updated = { ...result, items }; setResult(updated); queryClient.setQueryData(['explore', submitId], updated);
    setPage(current => Math.max(1, Math.min(current, Math.ceil(items.length / pageSize))));
  };
  const edited = async (id: string) => { const book = await api.get<Book>(`/books/${id}`); if (result) updateResult(result.items.map(item => item.id === id ? book : item)); };
  const clear = () => { setSearchQuery(''); setKeyword(''); setStatus(null); setPage(1); };

  return <div className='h-full flex flex-col'>
    <header className='border-b border-border p-6'>
      <div className='flex flex-col gap-4 mb-6'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex-1 min-w-[240px] max-w-2xl'>
            <SearchBar value={searchQuery} onChange={value => { setSearchQuery(value); setValidation(''); if (!aiMode) { setKeyword(value); setPage(1); } }} placeholder={aiMode ? 'Describe ideas, themes or a book you liked' : undefined} aiMode={aiMode} onSubmit={aiMode ? () => void submit(searchQuery) : undefined} />
          </div>
          {aiMode && <Button onClick={() => void submit(searchQuery)}>Search</Button>}
          <div className='flex items-center gap-2'><Switch id='explore-mode' checked={aiMode} onCheckedChange={checked => checked ? activate() : deactivate()} /><label htmlFor='explore-mode'>Explore with AI</label></div>
          <div className='flex items-center gap-2'>
            <Button aria-label='Grid view' variant={view === 'grid' ? 'default' : 'outline'} size='icon' onClick={() => setView('grid')}><Grid3x3 className='w-4 h-4' /></Button>
            <Button aria-label='List view' variant={view === 'list' ? 'default' : 'outline'} size='icon' onClick={() => setView('list')}><List className='w-4 h-4' /></Button>
            <Button aria-label='Filter' variant='outline' size='icon'><Filter className='w-4 h-4' /></Button>
          </div>
          <Tabs value={status?.toString() ?? 'all'} onValueChange={v => { setStatus(v === 'all' ? null : Number(v) as ReadingStatus); setPage(1); }}><TabsList>{[['all','All'],['0','Unread'],['1','Reading'],['2','Read']].map(([value, label]) => <TabsTrigger key={value} value={value} disabled={aiMode}>{label}</TabsTrigger>)}</TabsList></Tabs>
        </div>
        {validation && <p role='alert' className='text-destructive text-sm'>{validation}</p>}
        {aiMode && <><p className='text-sm text-muted-foreground'>AI search sends your books' details, including your personal notes, and what you type here to OpenAI.</p>{!submitId && <div className='flex flex-wrap gap-2'>{examples.map(example => <Button key={example} variant='outline' size='sm' onClick={() => setSearchQuery(example)}>{example}</Button>)}</div>}</>}
        {showPro && <div role='region' aria-label='Explore with AI Pro' className='rounded-lg border p-4'><div className='flex justify-between'><h2 className='font-semibold'>Explore with AI is a Pro feature</h2><Button variant='ghost' size='sm' onClick={() => setShowPro(false)} aria-label='Dismiss'> <X className='h-4 w-4' /></Button></div><p>Find books by ideas, themes and meaning. Pro cannot be purchased yet.</p><p className='text-sm text-muted-foreground mt-2'>With Pro, your books' details, including your personal notes, and your Explore prompts are sent to OpenAI to power AI search.</p></div>}
        {!aiMode && hasFilter && <div className='flex justify-end'><Button variant='outline' onClick={clear} size='sm'><X className='h-4 w-4 mr-2' />Clear Filters</Button></div>}
      </div>
      <h1 className='text-3xl font-bold text-foreground mb-1'>Library</h1><p className='text-muted-foreground'>{result?.truncated && aiMode ? `Showing only the top ${count ?? 0} matches` : `${count ?? 0} ${count === 1 ? 'book' : 'books'}${(aiMode && submitId) || hasFilter ? ' found' : ''}`}</p>
    </header>
    <div className='flex-1 overflow-auto'><div className='p-6'>
      {isLoading ? <div aria-label='Loading results'><BooksGridSkeleton /></div> : aiMode && failed ? <div role='alert'><p>AI search is unavailable right now.</p><div className='flex gap-2 mt-4'><Button onClick={() => void submit(searchQuery)}>Try again</Button><Button variant='outline' onClick={deactivate}>Search by keyword instead</Button></div></div> : items && items.length > 0 ? <>
        <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6' : 'flex flex-col gap-3 max-w-4xl'}>{items.map(book => <BookCard key={book.id} book={book} viewMode={view} onDeleted={aiMode && submitId ? id => updateResult(result!.items.filter(item => item.id !== id)) : undefined} onEdited={aiMode && submitId ? id => void edited(id) : undefined} />)}</div>
        {pages != null && (pages > 1 || (aiMode && !!submitId && (count ?? 0) > 0)) && <div className='mt-8'><BooksPagination currentPage={page} totalPages={pages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={size => { setPageSize(size); setPage(1); }} totalCount={count ?? 0} /></div>}
        {!aiMode && !!debouncedSearch.trim() && <div className='mt-8'><Button variant='outline' onClick={() => activate()}>Explore with AI</Button><p className='text-sm text-muted-foreground mt-1'>Find books by ideas, themes and meaning</p></div>}
      </> : aiMode && submitId ? <p>No relevant books in your library</p> : hasFilter ? <><SearchEmptyState searchTerm={debouncedSearch} onClear={clear} />{debouncedSearch.trim() && <div className='text-center'><Button onClick={() => activate(true)}>Try exploring by meaning</Button></div>}</> : <EmptyState />}
    </div></div>
  </div>;
};
export default Library;
