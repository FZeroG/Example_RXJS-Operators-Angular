# คู่มือ RxJS Operators ใน Angular ตั้งแต่พื้นฐานถึง Advanced

เอกสารนี้รวบรวม RxJS operators ที่ใช้บ่อยใน Angular ตั้งแต่พื้นฐาน ระดับกลาง ไปจนถึง advanced เพื่อช่วยออกแบบ flow ของงาน asynchronous ให้อ่านง่าย ควบคุมได้ และลดปัญหาที่มักเกิดจากจังหวะเวลา response เก่า memory leak และ error handling ที่กระจัดกระจาย

## ภาพรวม

ใน Angular เรามักเจอ stream จากหลายแหล่ง:

- `HttpClient` สำหรับเรียก API
- `FormControl.valueChanges` สำหรับติดตามค่าฟอร์ม
- `ActivatedRoute.params` หรือ `queryParams`
- event จากผู้ใช้ เช่น click, input, scroll
- WebSocket หรือ real-time data
- state ภายใน service ที่ expose เป็น `Observable`

RxJS operators ทำหน้าที่กำหนดพฤติกรรมของ stream เช่น หน่วงเวลา ข้ามค่าซ้ำ แปลงค่าเป็น HTTP request รวมหลาย request จัดการ error ปิด subscription และ cache ผลลัพธ์ล่าสุด

## แบ่งระดับ operators

| ระดับ | Operators | ใช้ทำอะไร |
|---|---|---|
| พื้นฐาน | `map`, `filter`, `tap`, `startWith` | แปลงค่า, กรองค่า, debug/side effect และกำหนดค่าเริ่มต้น |
| ระดับกลาง | `debounceTime`, `distinctUntilChanged`, `catchError`, `retry`, `finalize`, `takeUntil` | ควบคุม timing, error, loading และ cleanup |
| Advanced | `switchMap`, `mergeMap`, `concatMap`, `exhaustMap`, `forkJoin`, `combineLatest`, `withLatestFrom`, `shareReplay`, `scan` | ควบคุม concurrency, cancellation, combination, caching และ state accumulation |

## กลุ่มพื้นฐานที่ควรเข้าใจให้แม่น

### `map`

ใช้แปลงค่าที่ไหลผ่าน stream ให้เป็นค่าใหม่ โดยไม่เปลี่ยนจังหวะของ stream เช่น เลือกเฉพาะ field ที่ต้องใช้ คำนวณค่าเพิ่ม หรือแปลง response ให้ component ใช้งานต่อได้ง่ายขึ้น

```ts
readonly productCards$ = this.productService.getProducts().pipe(
  map((products) =>
    products.map((item) => ({
      id: item.id,
      name: item.name,
      priceWithVat: item.price * 1.07,
      inStock: item.stock > 0,
    }))
  )
);
```

จำง่าย ๆ:

> input หนึ่งค่าเข้าไป แล้ว output หนึ่งค่าใหม่ออกมา

### `filter`

ส่งต่อเฉพาะค่าที่ผ่านเงื่อนไข เหมาะกับการกันข้อมูลที่ยังไม่พร้อม เช่น keyword สั้นเกินไป id ว่าง หรือ user เป็น `null`

```ts
readonly validKeyword$ = this.searchControl.valueChanges.pipe(
  filter((keyword) => keyword.trim().length >= 2)
);
```

ใน Angular search flow มักใช้ก่อน `switchMap` เพื่อไม่เรียก API ด้วยคำค้นที่สั้นเกินไป

### `tap`

ใช้ทำ side effect โดยไม่เปลี่ยนค่าที่ส่งต่อใน stream เช่น log, analytics, set loading หรือ debug

```ts
readonly products$ = this.productService.getProducts().pipe(
  tap(() => this.loading.set(true)),
  tap((products) => console.log('products loaded', products.length))
);
```

ข้อควรระวัง: อย่าใช้ `tap` เพื่อแปลงข้อมูล ถ้าต้องการเปลี่ยนรูปข้อมูลให้ใช้ `map`

### `startWith`

กำหนดค่าเริ่มต้นให้ stream emit ก่อนค่าจริงจะมาถึง มีประโยชน์มากกับ `combineLatest` เพราะ `combineLatest` ต้องรอให้ทุก stream emit อย่างน้อยหนึ่งครั้งก่อน

```ts
readonly category$ = this.categoryControl.valueChanges.pipe(
  startWith('all')
);
```

ใช้เมื่อ:

- ต้องการ initial UI state
- ต้องให้ `combineLatest` เริ่มทำงานทันที
- ต้องการค่า default ก่อนผู้ใช้เลือกค่าเอง

## ตัวอย่างการใช้ Operators พื้นฐานร่วมกัน

```ts
readonly products$ = this.productService.getProducts().pipe(
  map((products) => products.filter((item) => item.stock > 0)),
  tap((products) => console.log('available products', products.length)),
  startWith([])
);
```

## กลุ่ม Timing และ Filtering

### `debounceTime`

รอให้ stream เงียบเป็นระยะเวลาหนึ่งก่อนปล่อยค่าล่าสุด เหมาะกับช่องค้นหา เพราะไม่ควรเรียก API ทุกครั้งที่ผู้ใช้กดแป้นพิมพ์

```ts
readonly keyword$ = this.searchControl.valueChanges.pipe(
  debounceTime(300)
);
```

ใช้เมื่อ:

- Search autocomplete
- Auto-save หลังหยุดพิมพ์
- Resize หรือ scroll event ที่ถี่มาก

### `distinctUntilChanged`

ข้ามค่าซ้ำที่ติดกัน เหมาะกับการลด request ซ้ำเมื่อค่าไม่ได้เปลี่ยนจริง

```ts
readonly keyword$ = this.searchControl.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged()
);
```

ถ้า stream emit `angular`, `angular`, `rxjs` ผลลัพธ์จะผ่านเป็น `angular`, `rxjs`

## กลุ่ม Error, Retry และ Loading

### `catchError`

จับ error แล้วคืน Observable ใหม่ เช่น fallback value เพื่อไม่ให้ stream หยุดทำงานหรือทำให้ UI แสดงผลผิดพลาด

```ts
readonly products$ = this.productService.getProducts().pipe(
  catchError(() => of([]))
);
```

ใช้เมื่อ:

- API ล้มแล้วแสดง empty state
- บาง request ใน `forkJoin` error แต่ไม่อยากให้ทั้งหน้าแสดง error ตามไปด้วย
- แปลง technical error เป็น user-friendly state

### `retry`

ลองทำ source Observable ซ้ำเมื่อเกิด error เหมาะกับ network error ชั่วคราว

```ts
readonly profile$ = this.userService.getProfile().pipe(
  retry(2),
  catchError(() => of(null))
);
```

ระวังอย่า retry request ที่ทำให้เกิด side effect โดยไม่ตั้งใจ เช่น payment หรือ create order

### `finalize`

ทำงานเมื่อ Observable จบ ไม่ว่าจะ complete, error หรือ unsubscribe เหมาะกับการปิด loading state อย่างสม่ำเสมอ

```ts
this.loading.set(true);

this.userService.getProfile().pipe(
  finalize(() => this.loading.set(false))
).subscribe();
```

## กลุ่ม Cleanup

### `takeUntil`

หยุด stream เมื่อ notifier emit ใช้เพื่อป้องกัน memory leak ใน component ที่ subscribe เอง

```ts
private readonly destroy$ = new Subject<void>();

ngOnInit() {
  this.socket.messages$.pipe(
    takeUntil(this.destroy$)
  ).subscribe((message) => this.messages.push(message));
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}
```

ใน Angular รุ่นใหม่ มักใช้ `takeUntilDestroyed` แทนเพราะสั้นและปลอดภัยกว่า:

```ts
private readonly destroyRef = inject(DestroyRef);

ngOnInit() {
  this.socket.messages$.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe();
}
```

## กลุ่ม Flattening และ Concurrency

กลุ่มนี้สำคัญมากเมื่อเราต้องเปลี่ยนค่าจาก stream หนึ่งให้กลายเป็น async request อีกชุดหนึ่ง

### `switchMap`

เมื่อมีค่าใหม่เข้ามา จะยกเลิกงานเก่าและใช้เฉพาะงานล่าสุด

```ts
readonly results$ = this.searchControl.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  filter((keyword) => keyword.trim().length >= 2),
  switchMap((keyword) =>
    this.productService.search(keyword).pipe(
      catchError(() => of([]))
    )
  )
);
```

ใช้เมื่อ:

- Search autocomplete
- Route param เปลี่ยนแล้วโหลด detail ใหม่
- Filter เปลี่ยนแล้วโหลด dashboard ใหม่

ไม่เหมาะเมื่อทุก request ต้องเสร็จครบ เช่น upload ทุกไฟล์ หรือ save ทุก change เพราะ request เก่าอาจถูกยกเลิก

### `mergeMap`

เริ่ม async task หลายงานพร้อมกัน เหมาะกับงานที่เป็นอิสระต่อกันและไม่จำเป็นต้องรักษาลำดับผลลัพธ์

```ts
from(files).pipe(
  mergeMap((file) => this.uploadService.upload(file), 3)
).subscribe();
```

ตัวเลข `3` คือ concurrency limit หมายถึง upload พร้อมกันไม่เกิน 3 งาน

ใช้เมื่อ:

- Upload หลายไฟล์
- เรียก request หลายงานที่ไม่ต้องเรียงลำดับ
- Event แต่ละตัวต้องทำงานให้ครบ ไม่ควรถูก cancel

### `concatMap`

ทำ async task ทีละงานตามลำดับ โดยงานถัดไปต้องรอให้งานก่อนหน้า complete ก่อน

```ts
from(changes).pipe(
  concatMap((change) => this.documentService.save(change))
).subscribe();
```

ใช้เมื่อ:

- Save queue
- ส่งคำสั่งที่ต้องเรียงลำดับ
- ป้องกัน race condition จาก request ที่แก้ข้อมูลเดียวกัน

### `exhaustMap`

ถ้างานเดิมยังไม่เสร็จ ค่าใหม่จะถูกข้าม เหมาะกับปุ่ม submit หรือ login ที่ต้องกันการกดซ้ำ

```ts
readonly loginResult$ = this.loginClicks$.pipe(
  exhaustMap(() => this.authService.login(this.form.getRawValue()))
);
```

ใช้เมื่อ:

- Login button
- Submit form
- Checkout button
- ปุ่มที่ไม่ควรเริ่ม request ใหม่ระหว่าง request เดิมยังทำงาน

## เปรียบเทียบ Map Operators

| Operator | ถ้ามี event ใหม่ระหว่างงานเดิมยังไม่เสร็จ | เหมาะกับ |
|---|---|---|
| `switchMap` | ยกเลิกงานเดิม แล้วเริ่มงานใหม่ | Search, route detail |
| `mergeMap` | ทำงานใหม่พร้อมกับงานเดิม | Upload หลายไฟล์, independent tasks |
| `concatMap` | ต่อคิว รอเรียงลำดับ | Save queue, ordered updates |
| `exhaustMap` | ไม่รับ event ใหม่จนกว่างานเดิมจะจบ | Login, submit, checkout |

## กลุ่ม Combination

### `forkJoin`

เริ่มหลาย Observable พร้อมกัน แล้ว emit ครั้งเดียวเมื่อทุกตัว complete เหมาะกับ HTTP หลาย endpoint ที่ต้องรอข้อมูลครบก่อนแสดงผล

```ts
readonly dashboard$ = forkJoin({
  profile: this.userService.getProfile(),
  orders: this.orderService.getRecentOrders(),
  alerts: this.alertService.getUnreadAlerts(),
}).pipe(
  catchError(() => of({ profile: null, orders: [], alerts: [] }))
);
```

ข้อควรระวัง:

- ถ้า Observable ใดไม่ complete เช่น WebSocket หรือ interval ที่ไม่จบ `forkJoin` จะไม่ emit
- ถ้า Observable ใด error ทั้งชุดจะ error เว้นแต่จัดการ error ภายในแต่ละตัว

### `combineLatest`

รวมค่าล่าสุดจากหลาย stream และ emit ใหม่เมื่อ stream ใด stream หนึ่งเปลี่ยน เหมาะกับ UI ที่คำนวณจาก state หลายส่วน

```ts
readonly visibleProducts$ = combineLatest([
  this.products$,
  this.categoryControl.valueChanges.pipe(startWith('all')),
  this.sortControl.valueChanges.pipe(startWith('popular')),
]).pipe(
  map(([products, category, sort]) => filterAndSort(products, category, sort))
);
```

ใช้เมื่อ:

- Product list + filter + sort
- Dashboard filter หลายตัว
- UI state ที่ต้องคำนวณจากหลาย source

### `withLatestFrom`

ให้ stream หลักเป็นตัว trigger แล้วหยิบค่าล่าสุดจาก stream อื่นมาใช้ประกอบ

```ts
readonly save$ = this.saveClicks$.pipe(
  withLatestFrom(this.formValue$),
  switchMap(([_, formValue]) => this.profileService.save(formValue))
);
```

ต่างจาก `combineLatest` คือ `withLatestFrom` จะ emit เมื่อ stream หลัก emit เท่านั้น

## กลุ่ม Caching และ Sharing

### `shareReplay`

แชร์ subscription และส่งค่าล่าสุดให้ subscriber ใหม่ เหมาะกับการ cache HTTP response ใน service

```ts
readonly currentUser$ = this.http.get<User>('/api/me').pipe(
  shareReplay({ bufferSize: 1, refCount: true })
);
```

ใช้เมื่อ:

- หลาย component ใช้ข้อมูลเดียวกัน
- ไม่อยากเรียก HTTP ซ้ำทุกครั้งที่มี subscriber ใหม่
- ต้องการ cache response ล่าสุดในช่วงที่ยังมี subscriber

ข้อควรระวัง:

- ถ้าใช้กับ stream ที่ไม่จบหรือ cache ใหญ่ ต้องระวัง memory
- ควรใช้ config object เช่น `{ bufferSize: 1, refCount: true }` เพื่อชัดเจน

## กลุ่ม State Accumulation

### `scan`

สะสมค่าใน stream คล้าย reducer เหมาะกับ state ที่ค่อย ๆ เปลี่ยนจาก event ต่อเนื่อง

```ts
readonly cart$ = this.cartEvents$.pipe(
  scan((cart, event) => reduceCart(cart, event), initialCart)
);
```

ใช้เมื่อ:

- สะสม message จาก WebSocket
- สร้าง cart state จาก add/remove events
- infinite scroll ที่ append รายการใหม่เข้า list เดิม

## Patterns ที่แนะนำใน Angular

### ใช้ `async` pipe เมื่อเป็นไปได้

```html
@if (results$ | async; as results) {
  @for (item of results; track item.id) {
    <app-product-card [product]="item" />
  }
}
```

ข้อดีคือ Angular จัดการ subscribe/unsubscribe ให้เอง

### ให้ service รับผิดชอบ API

```ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  search(keyword: string) {
    return this.http.get<Product[]>('/api/products', {
      params: { q: keyword },
    });
  }
}
```

### ให้ component ประกอบ stream

```ts
readonly vm$ = combineLatest({
  user: this.userService.currentUser$,
  products: this.results$,
  loading: this.loading$,
});
```

## สรุปการเลือกใช้แบบรวดเร็ว

| สถานการณ์ | Operator ที่เหมาะ |
|---|---|
| แปลง API response เป็นข้อมูลสำหรับ UI | `map` |
| กรองค่า null หรือ keyword สั้นเกินไป | `filter` |
| debug หรือทำ side effect โดยไม่เปลี่ยนค่า | `tap` |
| ใส่ค่าเริ่มต้นให้ stream | `startWith` |
| ผู้ใช้พิมพ์ค้นหา | `debounceTime`, `distinctUntilChanged`, `switchMap` |
| route id เปลี่ยนแล้วโหลดข้อมูลใหม่ | `switchMap` |
| upload หลายไฟล์พร้อมกัน | `mergeMap` |
| save หลายรายการตามลำดับ | `concatMap` |
| กันกด submit ซ้ำ | `exhaustMap` |
| โหลดหลาย HTTP endpoint แล้วรอครบ | `forkJoin` |
| รวม filter, sort, data เป็น UI เดียว | `combineLatest` |
| click แล้วใช้ค่าล่าสุดจาก form/state | `withLatestFrom` |
| API error แล้วแสดง fallback | `catchError` |
| ปิด loading เสมอเมื่อ request จบ | `finalize` |
| cleanup subscription | `takeUntil` หรือ `takeUntilDestroyed` |
| cache HTTP response ให้หลาย component | `shareReplay` |
| สะสม state จาก events | `scan` |

แนวคิดสำคัญคืออย่าจำ operator เป็นชื่อแยก ๆ เพียงอย่างเดียว ให้เริ่มจากพฤติกรรมของ async flow ที่ต้องการก่อน แล้วค่อยเลือก operator ให้ตรงกับพฤติกรรมนั้น
