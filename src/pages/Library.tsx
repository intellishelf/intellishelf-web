import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { ReadingStatus, BookOrderBy, type Book, type PagedResult } from '@/types/book';
import type { UserResponse } from '@/types/auth';

type ExploreResult = { items: Book[]; truncated: boolean };
type Snapshot = { userId: string; frozenTerm: string; prompt: string; page: number; pageSize: number; submitId: string | null; status: ReadingStatus | null; view: 'grid' | 'list'; frozen: { items: Book[]; totalCount: number; totalPages: number } };
// History state holds only an opaque key; prompts and results disappear on reload.
const entries = new Map<string, Snapshot>();
let libraryOwner: string | undefined;
const examples = ['Books about how knowledge grows', 'Stories of loneliness and isolation', 'What do I own about scientific explanations?', 'Books similar to The Beginning of Infinity'];

const LibraryView = () => {
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
  const pageSizeRef = useRef(pageSize);
  const [view, setView] = useState<'grid' | 'list'>(saved?.view ?? 'grid');
  const [submitId, setSubmitId] = useState<string | null>(saved?.submitId ?? null);
  const [frozenReady, setFrozenReady] = useState(!!saved);
  const [frozenTerm, setFrozenTerm] = useState(saved?.frozenTerm ?? debouncedSearch);
  const [frozen, setFrozen] = useState<Snapshot['frozen']>(saved?.frozen ?? { items: [], totalCount: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [validation, setValidation] = useState('');
  const [showPro, setShowPro] = useState(false);
  const [sessionChanged, setSessionChanged] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(false);
  const clearingSession = useRef(false);
  const requestId = useRef(0);
  const currentSubmit = useRef<string | null>(saved?.submitId ?? null);
  const [result, setResult] = useState<ExploreResult | undefined>(() => saved?.submitId ? queryClient.getQueryData(['explore', saved.submitId]) : undefined);
  const appliedTerm = aiMode ? frozenTerm : debouncedSearch;
  const hasFilter = !!appliedTerm.trim() || status !== null;
  const { data: searchData, isLoading: searching, isError: searchError } = useSearchBooks({ searchTerm: appliedTerm, status, page, pageSize }, !sessionChanged && (!aiMode || (!frozenReady && !submitId && !failed)));
  const { data: allBooks, isLoading: loadingAll, isError: allError } = useBooks({ page, pageSize, orderBy: BookOrderBy.Added, ascending: false }, !sessionChanged && (!aiMode || (!frozenReady && !submitId && !failed)));
  const totalKey = ['library-total', user?.id];
  const loadTotal = () => api.get<PagedResult<Book>>('/books', { page: 1, pageSize: 1 });
  const ordinary = hasFilter ? searchData : allBooks;
  const shown = aiMode ? frozen : ordinary;
  const items = aiMode && submitId ? result?.items.slice((page - 1) * pageSize, page * pageSize) : shown?.items;
  const count = aiMode && submitId ? result?.items.length : shown?.totalCount;
  const pages = aiMode && submitId ? Math.ceil((count ?? 0) / pageSize) : shown?.totalPages;
  const isLoading = aiMode ? loading || (!submitId && !failed && !frozenReady && (hasFilter ? searching : loadingAll)) : hasFilter ? searching : loadingAll;
  const ordinaryError = hasFilter ? searchError : allError;

  useEffect(() => {
    if (aiMode && !frozenReady && ordinary) {
      setFrozen({ items: ordinary.items, totalCount: ordinary.totalCount, totalPages: ordinary.totalPages });
      setFrozenReady(true);
    }
  }, [aiMode, frozenReady, ordinary]);

  const restoredEntry = useRef(!!saved);
  useEffect(() => {
    if (!restoredEntry.current) {
      entries.clear();
      queryClient.removeQueries({ queryKey: ['explore'] });
    }
    const sequence = requestId;
    return () => { ++sequence.current; };
  }, [queryClient]);

  useEffect(() => {
    if (aiMode) {
      const clean: Record<string, string> = {};
      if (status !== null) clean.status = String(status);
      setParams(clean, { replace: true, state: { libraryKey: entryKey } });
      if (entryKey) entries.set(entryKey, { userId: user?.id ?? '', frozenTerm, prompt: searchQuery, page, pageSize, submitId, status, view, frozen });
    } else if (clearingSession.current) {
      setParams({}, { replace: true, state: null });
      if (!debouncedSearch) clearingSession.current = false;
    } else {
      const next: Record<string, string> = {};
      if (debouncedSearch) next.search = debouncedSearch;
      if (status !== null) next.status = String(status);
      if (page !== 1) next.page = String(page);
      if (pageSize !== 24) next.pageSize = String(pageSize);
      setParams(next, { replace: true });
    }
  }, [aiMode, debouncedSearch, status, page, pageSize, setParams, entryKey, searchQuery, submitId, view, frozen, frozenTerm, user?.id]);

  const discard = (id: string | null) => {
    if (!id) return;
    void queryClient.cancelQueries({ queryKey: ['explore', id] });
    queryClient.removeQueries({ queryKey: ['explore', id] });
  };
  const submit = async (prompt: string) => {
    if (sessionChanged || !prompt.trim()) return;
    if (prompt.length > 500) { setValidation('Please enter 500 characters or fewer.'); return; }
    setValidation(''); setFailed(false); setLoading(true);
    const sequence = ++requestId.current;
    const submitUserId = user?.id;
    try {
      // The session cookie may have changed in another tab since the user was loaded.
      const currentUser = await api.get<UserResponse>('/auth/me');
      if (sequence !== requestId.current) return;
      if (!submitUserId || currentUser.id !== submitUserId) {
        queryClient.setQueryData(['auth', 'me'], currentUser);
        return;
      }
      if (!currentUser.isPro) {
        queryClient.setQueryData(['auth', 'me'], currentUser);
        discard(currentSubmit.current); currentSubmit.current = null; entries.delete(entryKey);
        setAiMode(false); setShowPro(true);
        return;
      }
      // This unfiltered count has its own key, independent of the frozen page.
      const total = await queryClient.fetchQuery({ queryKey: totalKey, queryFn: loadTotal, staleTime: 0 });
      if (sequence !== requestId.current) return;
      if (total.totalCount === 0) { setLoading(false); return; }
      discard(currentSubmit.current);
      const id = crypto.randomUUID();
      currentSubmit.current = id;
      setPage(1); setSubmitId(id); setResult(undefined);
      const data = await queryClient.fetchQuery({ queryKey: ['explore', id], queryFn: () => api.post<ExploreResult>('/books/explore', { prompt: prompt.trim() }, { 'X-Explore-User-Id': submitUserId }), retry: false, staleTime: Infinity, gcTime: Infinity });
      if (sequence === requestId.current) setResult(data);
      else discard(id);
    } catch (error) {
      if (sequence !== requestId.current) return;
      if (error instanceof ApiError && error.status === 409 && error.type === 'Explore.SessionChanged') {
        setSessionChanged(true); setSessionNotice(true); clearingSession.current = true;
        entries.clear(); currentSubmit.current = null;
        for (const key of [['books'], ['explore'], ['library-total']]) {
          void queryClient.cancelQueries({ queryKey: key }); queryClient.removeQueries({ queryKey: key });
        }
        setSearchQuery(''); setKeyword(''); setFrozenTerm(''); setFrozen({ items: [], totalCount: 0, totalPages: 0 });
        setFrozenReady(false); setResult(undefined); setSubmitId(null); setAiMode(false); setStatus(null); setPage(1); setFailed(false);
        navigate({ pathname: location.pathname, search: '' }, { replace: true, state: null });
        try {
          const refreshed = await api.get<UserResponse>('/auth/me');
          queryClient.setQueryData(['auth', 'me'], refreshed);
          setSessionChanged(false);
        } catch {
          // Stay locked until the page is reloaded with a valid session.
        }
      } else if (error instanceof ApiError && error.status === 403 && error.type === 'Explore.ProRequired') {
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        discard(currentSubmit.current); currentSubmit.current = null; entries.delete(entryKey);
        setAiMode(false); setShowPro(true);
      } else setFailed(true);
    } finally { if (sequence === requestId.current) setLoading(false); }
  };
  const activate = (run = false) => {
    if (sessionChanged) return;
    if (!user?.isPro) { setShowPro(true); return; }
    for (const entry of entries.values()) discard(entry.submitId);
    entries.clear();
    const newKey = crypto.randomUUID();
    setEntryKey(newKey); setFrozenTerm(debouncedSearch);
    setFrozenReady(!!ordinary);
    if (ordinary) setFrozen({ items: ordinary.items, totalCount: ordinary.totalCount, totalPages: ordinary.totalPages });
    setAiMode(true); setShowPro(false); setSubmitId(null); currentSubmit.current = null; setResult(undefined); setFailed(false);
    navigate({ pathname: location.pathname, search: status === null ? '' : `?status=${status}` }, { replace: true, state: { libraryKey: newKey } });
    if (run) void submit(searchQuery);
  };
  const deactivate = () => {
    ++requestId.current; discard(currentSubmit.current); currentSubmit.current = null;
    setLoading(false); setAiMode(false); setKeyword(searchQuery); setPage(1); setFailed(false); setValidation('');
    if (entryKey) entries.delete(entryKey);
  };
  const updateResult = (id: string, change: (items: Book[]) => Book[], clampPage = false) => {
    if (currentSubmit.current !== id) return;
    const current = queryClient.getQueryData<ExploreResult>(['explore', id]);
    if (!current) return;
    const updated = { ...current, items: change(current.items) };
    queryClient.setQueryData(['explore', id], updated); setResult(updated);
    if (clampPage) setPage(page => Math.max(1, Math.min(page, Math.ceil(updated.items.length / pageSizeRef.current))));
  };
  const edited = async (id: string, submission: string) => {
    try {
      const book = await api.get<Book>(`/books/${id}`);
      updateResult(submission, items => items.map(item => item.id === id ? book : item));
    } catch {
      toast.error('The book was saved, but its details could not be refreshed.');
    }
  };
  const clear = () => { setSearchQuery(''); setKeyword(''); setStatus(null); setPage(1); };

  return <div className='h-full flex flex-col'>
    <header className='border-b border-border p-6'>
      <div className='flex flex-col gap-4 mb-6'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex-1 min-w-[240px] max-w-2xl'>
            <SearchBar value={searchQuery} onChange={value => { setSearchQuery(value); setValidation(''); if (!aiMode) { setKeyword(value); setPage(1); } }} placeholder={aiMode ? 'Describe ideas, themes or a book you liked' : undefined} aiMode={aiMode} onSubmit={aiMode ? () => void submit(searchQuery) : undefined} />
          </div>
          {aiMode && <Button onClick={() => void submit(searchQuery)}>Search</Button>}
          <div className='flex items-center gap-2'><Switch id='explore-mode' disabled={sessionChanged} checked={aiMode} onCheckedChange={checked => checked ? activate() : deactivate()} /><label htmlFor='explore-mode'>Explore with AI</label></div>
          <div className='flex items-center gap-2'>
            <Button aria-label='Grid view' variant={view === 'grid' ? 'default' : 'outline'} size='icon' onClick={() => setView('grid')}><Grid3x3 className='w-4 h-4' /></Button>
            <Button aria-label='List view' variant={view === 'list' ? 'default' : 'outline'} size='icon' onClick={() => setView('list')}><List className='w-4 h-4' /></Button>
            <Button aria-label='Filter' variant='outline' size='icon'><Filter className='w-4 h-4' /></Button>
          </div>
          <Tabs value={status?.toString() ?? 'all'} onValueChange={v => { setStatus(v === 'all' ? null : Number(v) as ReadingStatus); setPage(1); }}><TabsList>{[['all','All'],['0','Unread'],['1','Reading'],['2','Read']].map(([value, label]) => <TabsTrigger key={value} value={value} disabled={aiMode}>{label}</TabsTrigger>)}</TabsList></Tabs>
        </div>
        {sessionNotice && <p role='status' className='text-sm'>Your session changed. Please try again{sessionChanged ? ' after reloading the page' : ''}.</p>}
        {validation && <p role='alert' className='text-destructive text-sm'>{validation}</p>}
        {aiMode && <><p className='text-sm text-muted-foreground'>AI search sends your books' details, including your personal notes, and what you type here to OpenAI.</p>{!submitId && <div className='flex flex-wrap gap-2'>{examples.map(example => <Button key={example} variant='outline' size='sm' onClick={() => setSearchQuery(example)}>{example}</Button>)}</div>}</>}
        {showPro && <div role='region' aria-label='Explore with AI Pro' className='rounded-lg border p-4'><div className='flex justify-between'><h2 className='font-semibold'>Explore with AI is a Pro feature</h2><Button variant='ghost' size='sm' onClick={() => setShowPro(false)} aria-label='Dismiss'> <X className='h-4 w-4' /></Button></div><p>Find books by ideas, themes and meaning. Pro cannot be purchased yet.</p><p className='text-sm text-muted-foreground mt-2'>With Pro, your books' details, including your personal notes, and your Explore prompts are sent to OpenAI to power AI search.</p></div>}
        {!aiMode && hasFilter && <div className='flex justify-end'><Button variant='outline' onClick={clear} size='sm'><X className='h-4 w-4 mr-2' />Clear Filters</Button></div>}
      </div>
      <h1 className='text-3xl font-bold text-foreground mb-1'>Library</h1><p className='text-muted-foreground'>{result?.truncated && aiMode ? `Showing only the top ${count ?? 0} matches` : `${count ?? 0} ${count === 1 ? 'book' : 'books'}${(aiMode && submitId) || hasFilter ? ' found' : ''}`}</p>
    </header>
    <div className='flex-1 overflow-auto'><div className='p-6'>
      {sessionChanged ? <p>Refreshing your session…</p> : isLoading ? <div aria-label='Loading results'><BooksGridSkeleton /></div> : aiMode && !submitId && !failed && !frozenReady && ordinaryError ? <p role='alert'>Unable to load your library.</p> : aiMode && failed ? <div role='alert'><p>AI search is unavailable right now.</p><div className='flex gap-2 mt-4'><Button onClick={() => void submit(searchQuery)}>Try again</Button><Button variant='outline' onClick={deactivate}>Search by keyword instead</Button></div></div> : items && items.length > 0 ? <>
        <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6' : 'flex flex-col gap-3 max-w-4xl'}>{items.map(book => <BookCard key={book.id} book={book} viewMode={view} onDeleted={aiMode && submitId ? id => updateResult(submitId, items => items.filter(item => item.id !== id), true) : undefined} onEdited={aiMode && submitId ? id => void edited(id, submitId) : undefined} />)}</div>
        {pages != null && (!aiMode || !!submitId) && (pages > 1 || (aiMode && !!submitId && (count ?? 0) > 0)) && <div className='mt-8'><BooksPagination currentPage={page} totalPages={pages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={size => { pageSizeRef.current = size; setPageSize(size); setPage(1); }} totalCount={count ?? 0} truncated={aiMode && !!result?.truncated} /></div>}
        {!aiMode && !!debouncedSearch.trim() && <div className='mt-8'><Button variant='outline' onClick={() => activate()}>Explore with AI</Button><p className='text-sm text-muted-foreground mt-1'>Find books by ideas, themes and meaning</p></div>}
      </> : aiMode && submitId ? <p>No relevant books in your library</p> : hasFilter ? <><SearchEmptyState searchTerm={debouncedSearch} onClear={clear} />{debouncedSearch.trim() && <div className='text-center'><Button onClick={() => activate(true)}>Try exploring by meaning</Button></div>}</> : <EmptyState />}
    </div></div>
  </div>;
};
const Library = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?.id;
  const [readyFor, setReadyFor] = useState<string | undefined>();

  useLayoutEffect(() => {
    if (!userId) return;
    if (libraryOwner && libraryOwner !== userId) {
      entries.clear();
      navigate({ pathname: location.pathname, search: '' }, { replace: true, state: null });
      for (const key of [['books'], ['explore'], ['library-total']]) {
        void queryClient.cancelQueries({ queryKey: key });
        queryClient.removeQueries({ queryKey: key });
      }
    }
    libraryOwner = userId;
    setReadyFor(userId);
  }, [queryClient, userId, navigate, location.pathname]);

  if (!userId || readyFor !== userId) return <BooksGridSkeleton />;
  return <LibraryView key={userId} />;
};
export default Library;
