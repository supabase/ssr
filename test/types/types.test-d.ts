import { createBrowserClient } from "../../src/createBrowserClient";
import { createServerClient } from "../../src/createServerClient";
import { expectType } from "tsd";

// Copied from ts-expect
// https://github.com/TypeStrong/ts-expect/blob/master/src/index.ts#L23-L27
export type TypeEqual<Target, Value> =
  (<T>() => T extends Target ? 1 : 2) extends <T>() => T extends Value ? 1 : 2
    ? true
    : false;

type Database = {
  public: {
    Tables: {
      shops: {
        Row: {
          address: string | null;
          id: number;
          shop_geom: unknown | null;
        };
        Insert: {
          address?: string | null;
          id: number;
          shop_geom?: unknown | null;
        };
        Update: {
          address?: string | null;
          id?: number;
          shop_geom?: unknown | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// type DatabaseWithInternals = {
//   __InternalSupabase: {
//     PostgrestVersion: "13";
//   };
//   public: {
//     Tables: {
//       shops: {
//         Row: {
//           address: string | null;
//           id: number;
//           shop_geom: unknown | null;
//         };
//         Insert: {
//           address?: string | null;
//           id: number;
//           shop_geom?: unknown | null;
//         };
//         Update: {
//           address?: string | null;
//           id?: number;
//           shop_geom?: unknown | null;
//         };
//         Relationships: [];
//       };
//     };
//     Views: {
//       [_ in never]: never;
//     };
//     Functions: {
//       [_ in never]: never;
//     };
//     Enums: {
//       [_ in never]: never;
//     };
//     CompositeTypes: {
//       [_ in never]: never;
//     };
//   };
// };

// TODO: should be availble on postgrest-js >1.21.0
// {
//   //  createBrowserClient should be able discriminate postgrest version
//   const pg13Client = createBrowserClient<DatabaseWithInternals>(
//     "HTTP://localhost:3000",
//     ""
//   );
//   const pg12Client = createBrowserClient<Database>("HTTP://localhost:3000", "");
//   const res13 = await pg13Client
//     .from("shops")
//     .update({ id: 21 })
//     .maxAffected(1);
//   const res12 = await pg12Client
//     .from("shops")
//     .update({ id: 21 })
//     .maxAffected(1);
//   expectType<typeof res13.data>(null);
//   expectType<typeof res12.Error>(
//     "maxAffected method only available on postgrest 13+"
//   );
// }

{
  // createBrowserClient should return a typed client
  const pg12Client = createBrowserClient<Database>("HTTP://localhost:3000", "");
  const res12 = await pg12Client.from("shops").select("*");
  expectType<
    TypeEqual<
      | {
          address: string | null;
          id: number;
          shop_geom: unknown | null;
        }[]
      | null,
      typeof res12.data
    >
  >(true);
}

{
  // createBrowserClient should infer everything to any without types provided
  const pg12Client = createBrowserClient("HTTP://localhost:3000", "");
  const res12 = await pg12Client
    .from("shops")
    .select("address, id, relation(field)");
  expectType<
    | {
        address: any;
        id: any;
        relation: {
          field: any;
        }[];
      }[]
    | null
  >(res12.data);
}

// TODO: should be availble on postgrest-js >1.21.0
// {
//   //  createServerClient should be able discriminate postgrest version
//   const pg13Client = createServerClient<DatabaseWithInternals>(
//     "HTTP://localhost:3000",
//     "",
//   );
//   const pg12Client = createServerClient<Database>("HTTP://localhost:3000", "");
//   const res13 = await pg13Client
//     .from("shops")
//     .update({ id: 21 })
//     .maxAffected(1);
//   const res12 = await pg12Client
//     .from("shops")
//     .update({ id: 21 })
//     .maxAffected(1);
//   expectType<typeof res13.data>(null);
//   expectType<typeof res12.Error>(
//     "maxAffected method only available on postgrest 13+",
//   );
// }

{
  // createServerClient should return a typed client
  const pg12Client = createServerClient<Database>("HTTP://localhost:3000", "");
  const res12 = await pg12Client.from("shops").select("*");
  expectType<
    TypeEqual<
      | {
          address: string | null;
          id: number;
          shop_geom: unknown | null;
        }[]
      | null,
      typeof res12.data
    >
  >(true);
}

{
  // createServerClient should infer everything to any without types provided
  const pg12Client = createServerClient("HTTP://localhost:3000", "");
  const res12 = await pg12Client
    .from("shops")
    .select("address, id, relation(field)");
  expectType<
    TypeEqual<
      | {
          address: any;
          id: any;
          relation: {
            field: any;
          }[];
        }[]
      | null,
      typeof res12.data
    >
  >(true);
}
