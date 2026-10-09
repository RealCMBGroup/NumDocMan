import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / '.env')

DATABASE_URL = (
    os.environ.get('DATABASE_URL')
    or os.environ.get('POSTGRES_URL')
    or os.environ.get('POSTGRES_URL_NON_POOLING')
)

if not DATABASE_URL:
    if os.environ.get('VERCEL'):
        raise RuntimeError(
            'A persistent database is required on Vercel. Configure DATABASE_URL '
            'or POSTGRES_URL with a hosted PostgreSQL connection string.'
        )
    DATABASE_URL = f"sqlite:///{BASE_DIR / 'numdocman.db'}"

if DATABASE_URL.startswith(('postgres://', 'postgresql://')):
    if DATABASE_URL.startswith('postgres://'):
        ASYNC_DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+asyncpg://', 1)
    else:
        ASYNC_DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)
    engine_kwargs = {
        'pool_size': 1 if os.environ.get('VERCEL') else 10,
        'max_overflow': 0 if os.environ.get('VERCEL') else 5,
        'pool_timeout': 30,
        'pool_recycle': 300 if os.environ.get('VERCEL') else 1800,
        'pool_pre_ping': True,
        'echo': False,
    }
elif DATABASE_URL.startswith('postgresql+asyncpg://'):
    ASYNC_DATABASE_URL = DATABASE_URL
    engine_kwargs = {
        'pool_size': 1 if os.environ.get('VERCEL') else 10,
        'max_overflow': 0 if os.environ.get('VERCEL') else 5,
        'pool_timeout': 30,
        'pool_recycle': 300 if os.environ.get('VERCEL') else 1800,
        'pool_pre_ping': True,
        'echo': False,
    }
elif DATABASE_URL.startswith('sqlite:///'):
    ASYNC_DATABASE_URL = DATABASE_URL.replace('sqlite:///', 'sqlite+aiosqlite:///', 1)
    engine_kwargs = {
        'echo': False,
    }
else:
    raise RuntimeError('Unsupported DATABASE_URL. Use postgresql://... or sqlite:///...')

engine = create_async_engine(ASYNC_DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
