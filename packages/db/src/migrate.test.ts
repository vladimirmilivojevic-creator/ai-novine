import { describe, expect, it } from 'vitest';
import { parsePostgresUrl } from './migrate.js';

describe('parsePostgresUrl', () => {
  it('cita obicnu Supabase vezu', () => {
    expect(
      parsePostgresUrl(
        'postgresql://postgres.abcdef:tajna@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
      ),
    ).toEqual({
      host: 'aws-0-eu-central-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.abcdef',
      password: 'tajna',
      database: 'postgres',
    });
  });

  it('podnosi doslovno upisan @ u lozinci', () => {
    const target = parsePostgresUrl(
      'postgresql://postgres.abcdef:pas@word@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    );
    expect(target.password).toBe('pas@word');
    expect(target.host).toBe('aws-0-eu-central-1.pooler.supabase.com');
  });

  it('podnosi @ kodiran kao %40', () => {
    const target = parsePostgresUrl(
      'postgresql://postgres.abcdef:pas%40word@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    );
    expect(target.password).toBe('pas@word');
  });

  it('podnosi kosu crtu i upitnik u lozinci', () => {
    const target = parsePostgresUrl(
      'postgresql://korisnik:a/b?c@db.primer.rs:6543/postgres?sslmode=require',
    );
    expect(target.password).toBe('a/b?c');
    expect(target.host).toBe('db.primer.rs');
    expect(target.port).toBe(6543);
    expect(target.database).toBe('postgres');
  });

  it('podrazumeva port 5432 i bazu postgres kad nisu navedeni', () => {
    const target = parsePostgresUrl('postgres://korisnik:tajna@db.primer.rs');
    expect(target.port).toBe(5432);
    expect(target.database).toBe('postgres');
  });

  it('odbija vezu bez ispravnog pocetka ili bez korisnika', () => {
    expect(() => parsePostgresUrl('mysql://korisnik:tajna@db.primer.rs/baza')).toThrow(
      /postgresql:\/\//,
    );
    expect(() => parsePostgresUrl('postgresql://db.primer.rs:5432/postgres')).toThrow(/"@"/);
  });
});
