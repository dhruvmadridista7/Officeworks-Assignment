import { FormEvent, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCategories } from '../api/queries';

function SearchForm() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="site-search">
        Search products
      </label>
      <input
        id="site-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products"
      />
      <button className="button button-search" type="submit">
        Search
      </button>
    </form>
  );
}

export function Layout() {
  const categories = useCategories();

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-main content-width">
          <Link
            className="brand"
            to="/"
            aria-label="Officeworks Catalogue home"
          >
            <span className="brand-mark" aria-hidden="true">
              O
            </span>
            <span>
              <strong>Officeworks</strong>
              <small>PRODUCT CATALOGUE</small>
            </span>
          </Link>
          <SearchForm />
        </div>
        <nav className="category-nav" aria-label="Product categories">
          <div className="content-width category-nav-inner">
            <NavLink to="/" end>
              All products
            </NavLink>
            {categories.isPending && (
              <span className="nav-status" role="status">
                Loading categories…
              </span>
            )}
            {categories.isError && (
              <button
                className="nav-retry"
                type="button"
                onClick={() => void categories.refetch()}
              >
                Categories unavailable — retry
              </button>
            )}
            {categories.data?.categories.map((category) => (
              <NavLink key={category.slug} to={`/category/${category.slug}`}>
                {category.name}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="content-width page-content" id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="content-width footer-inner">
          <span>Officeworks Product Catalogue</span>
          <span>Find the right thing for every workspace.</span>
        </div>
      </footer>
    </div>
  );
}
