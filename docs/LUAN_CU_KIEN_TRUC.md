# Luận cứ kiến trúc: vì sao làm thế này, không làm thì sao

Mỗi thành phần ở đây phải trả lời ba câu: **giải quyết vấn đề gì cụ thể**, **không có nó thì hỏng ở
đâu**, **vì sao chọn cái này mà không chọn cái khác**. Cái gì không trả lời được thì không làm. Dùng
tệp này cho chương kiến trúc của báo cáo và để trả lời vấn đáp. Thiết kế chi tiết:
`docs/PHAN_TICH_THIET_KE.md`; toàn cảnh kỹ thuật: `docs/HE_THONG.md`.

**Luật cập nhật**: thêm hay bỏ một công nghệ, một hàng đợi, một service → thêm hay sửa một dòng ở
§3 hoặc §4 kèm lý do, trong cùng PR.

## 1. Bài toán thật và tải thật

Hợp đồng dịch vụ, phần mềm, thi công trả tiền theo **mốc**. Mỗi lần chi một mốc, ngày nay kế toán và
chủ hợp đồng phải đối chiếu bằng tay: đủ biên bản và hoá đơn chưa, đúng người có thẩm quyền ký chưa,
đủ người duyệt chưa, có đang tranh chấp không, trễ bao nhiêu ngày sau ân hạn và phạt bao nhiêu, đã chi
chưa (tránh chi hai lần). Sai ở đâu cũng là **mất tiền hoặc kiện tụng**, và khi kiểm toán hỏi "vì sao
chi" thì không ai tái dựng được.

Hệ thống giải quyết bằng: điều kiện chi viết thành **luật có phiên bản**; mọi chứng từ, phê duyệt,
tranh chấp đi qua hệ thống; engine chấm lại mốc sau mỗi thao tác, ra quyết định **kèm vết luật**; lệnh
chi chỉ tạo được từ một quyết định trả tiền, và **không thể chi hai lần**; mọi thao tác vào nhật ký
**không sửa được** (chuỗi băm).

Tải: bộ dữ liệu mẫu (bài toán gốc) có 100 hợp đồng, 405 mốc, 1.134 sự kiện, 65 bên. Một doanh nghiệp vừa
cỡ vài nghìn hợp đồng mỗi năm, vài chục thao tác ghi mỗi phút lúc cao điểm. **Đây không phải bài toán
tải lớn.** Một ứng dụng nguyên khối (monolith) chia mô-đun chạy thừa sức, và CodeCash đã chạy đúng
như vậy.

Vì vậy, ta **không** biện minh microservices bằng hiệu năng. Lý do thật là:

1. **Ranh giới rủi ro khác nhau.** Chữ ký có giá trị pháp lý; dòng tiền cần chống chi trùng; engine
   phải tái lập được kết quả; nhật ký phải độc lập với người bị kiểm toán. Tách ra thì lỗi hoặc thay đổi
   ở phần soạn thảo không chạm tới phần chi tiền, và mỗi phần có quyền truy cập dữ liệu riêng.
2. **Phụ thuộc ngoài không đáng tin**: nhà cung cấp ký số, ngân hàng. Cần cô lập để khi chúng chậm
   hoặc sập thì phần còn lại vẫn chạy (§5, §6).
3. **Ngôn ngữ khác nhau**: engine Python đã kiểm chứng trên 405 mốc của dữ liệu mẫu. Viết lại sang TypeScript là
   rủi ro lớn nhất có thể tránh.
4. **Sáu người làm song song** trong ba tuần: mỗi người một repo, không giẫm chân (`KIEN_TRUC_REPO.md`).
5. Môn Kiến trúc Microservices yêu cầu.

Câu nên nói khi vấn đáp: *"Với tải này, monolith là đủ; nhóm chọn microservices vì ranh giới rủi ro và
phụ thuộc ngoài, và đã trả giá bằng saga, outbox, idempotency; đây là các chi phí đó."* Bằng chứng cho
từng ranh giới (sáu tiêu chí, số đo lịch sử mã, kịch bản thay đổi và sự cố, so sánh phương án): §2.

## 2. Tách service: đủ chưa, đúng chưa

Một ranh giới service chỉ đáng giá khi **hai bên của nó khác nhau thật** ở ít nhất vài điểm: ngôn ngữ
nghiệp vụ, dữ liệu sở hữu, nhịp thay đổi, mức rủi ro và quyền truy cập, phụ thuộc ngoài, cách hỏng. Nếu
hai phần giống nhau ở mọi điểm thì tách chỉ đổi lời gọi hàm thành lời gọi mạng, đắt hơn mà không được gì.
Mục này kiểm từng ranh giới theo sáu tiêu chí đó, có số đo từ lịch sử mã CodeCash, rồi so với các
phương án chia khác.

### 2.1. Tiêu chí và kết quả từng service

| Tiêu chí | Câu hỏi | Vì sao quan trọng |
| --- | --- | --- |
| T1 Ngôn ngữ nghiệp vụ | Cùng một từ có nghĩa khác nhau ở hai bên không? | Khác nghĩa mà chung mô hình thì mô hình thành mớ điều kiện `if` |
| T2 Dữ liệu và nhất quán | Dữ liệu nào phải đổi **cùng một giao dịch**? | Cái phải nhất quán tức thì phải ở cùng một service |
| T3 Nhịp thay đổi | Hai phần có hay phải sửa cùng lúc không? | Hay sửa cùng nhau mà tách ra thì mỗi thay đổi thành hai PR, hai lần triển khai |
| T4 Rủi ro, quyền | Lộ hay sai ở phần này thì mất gì? Ai được đụng? | Giới hạn thiệt hại và quyền (ai giữ khoá ngân hàng, ai giữ khoá ký) |
| T5 Phụ thuộc ngoài | Có gọi hệ thống bên ngoài hay thay đổi, hay sập không? | Cô lập để bên ngoài sập không kéo cả hệ |
| T6 Cách hỏng, cách co giãn | Hỏng thì phần còn lại có được phép chạy tiếp không? Tải có hình dạng khác không? | Cho phép "hỏng một phần" thay vì "hỏng toàn bộ" |

| Service | T1 Ngôn ngữ | T2 Dữ liệu nhất quán trong | T3 Nhịp đổi (đo §2.2) | T4 Rủi ro, quyền | T5 Phụ thuộc ngoài | T6 Hỏng thì |
| --- | --- | --- | --- | --- | --- | --- |
| identity | "người dùng", "phiên", "vai trò" | tài khoản, mật khẩu băm, phiên | đổi một mình 65% | lộ mật khẩu, giả token: chỉ một nơi giữ khoá ký | — | ai đã đăng nhập vẫn thao tác tới khi hết token (15 phút); đăng nhập mới chờ |
| contract | "hợp đồng" = **bản đang thương lượng**, có phiên bản, bình luận, xác nhận | bản nháp, mốc dự kiến, thành viên | đổi một mình 20% (ranh giới yếu nhất, §2.5) | sửa điều khoản sau khi chốt | — | không soạn được; hợp đồng đang thực hiện không ảnh hưởng |
| signing | "văn bản" = **bản đóng băng có mã băm**; "lượt ký" | văn bản, phiên ký, lượt | đổi một mình 52% | chữ ký sai người, văn bản bị đổi sau ký: rủi ro pháp lý | nhà cung cấp ký (CA) | không ký được; mọi phần khác chạy |
| execution | "hợp đồng" = **cam kết đang chạy, bất biến**; "mốc", "chứng từ" | mốc, chứng từ, phê duyệt, tranh chấp: **một dòng sự kiện** | đổi một mình 42% | chứng từ của bên không có thẩm quyền | — | không nộp, không duyệt được; chi tiền đã gửi vẫn đối soát |
| decision | "luật", "phiên bản", "quyết định", "vết" | phiên bản luật, kết quả, vết (chỉ ghi thêm) | đổi một mình 57%; ít dính nhất với mọi phần (Jaccard 0,19–0,23) | sai số tiền; phải tái lập được kết quả cũ | — (Python) | chứng từ vẫn nhận, mốc `PENDING_EVALUATION` (S3) |
| payment | "lệnh chi", "đối soát", "khoá idempotency" | lệnh chi, nhật ký saga | ít đổi (CodeCash mới có phần khung) | **chi sai, chi trùng**: rủi ro tiền; giữ khoá API ngân hàng | ngân hàng | lệnh mới chờ; đã gửi thì `PENDING`, đối soát sau |
| audit | "mục nhật ký", "đầu chuỗi", "neo" | bản sao nhật ký, chỉ ghi thêm | đổi kèm tính năng (27% một mình, §2.5) | người bị kiểm toán sửa được lịch sử | dịch vụ dấu thời gian (sau này) | thao tác vẫn chạy; nhật ký nằm trong outbox, về sau |

Kết luận đọc từ bảng: mỗi service khác các service còn lại ở **ít nhất ba tiêu chí**. Hai trường hợp
mạnh nhất là decision (khác ngôn ngữ lập trình, ít dính nhất, hàm thuần) và payment (rủi ro tiền, phụ
thuộc ngân hàng, quyền riêng). Trường hợp yếu nhất là contract (§2.5).

### 2.2. Bằng chứng từ lịch sử mã

Cách đo: lấy 263 commit của CodeCash (19/10–26/11/2026, mã một khối), gán mỗi tệp đổi vào vùng nghiệp
vụ sẽ thành service theo `DOI_CHIEU_CODECASH.md`, rồi đếm. Hai vùng "dính" nhau khi hay được sửa trong
cùng một commit (đo bằng Jaccard: số commit sửa cả hai chia số commit sửa ít nhất một).

| Số đo | Giá trị | Đọc thế nào |
| --- | --- | --- |
| Commit có đụng vùng nghiệp vụ | 145 | |
| … chỉ đụng **một** vùng | 68 (47%) | gần một nửa thay đổi nằm gọn trong một service tương lai |
| … đụng tối đa hai vùng | 105 (72%) | |
| … đụng 4–6 vùng | 26 (18%) | chủ yếu là việc quét giao diện, i18n, đổi tên: sau khi tách, phần này nằm ở web và phần nền, không ở service |

Trong 105 commit tập trung (≤ 2 vùng):

| Vùng | Bị đụng | Đụng một mình | Tỷ lệ một mình |
| --- | --- | --- | --- |
| identity | 23 | 15 | 65% |
| decision | 28 | 16 | 57% |
| signing | 29 | 15 | 52% |
| execution | 40 | 17 | 42% |
| audit | 11 | 3 | 27% |
| contract | 10 | 2 | 20% |
| payment | 1 | 0 | — (mới có khung) |

Cặp hay sửa cùng nhau nhất: execution–signing (6 commit), rồi execution–identity, audit–execution,
decision–signing, decision–execution, contract–execution (mỗi cặp 4). Không cặp nào áp đảo: thay đổi
**không** dồn về một cặp, nên không có hai service nào thực chất là một.

Giới hạn của số đo, nói luôn khi vấn đáp: lịch sử ngắn (5 tuần), viết bởi nhóm dự thi trên một khối mã,
nên nó nói về **độ dính của nghiệp vụ**, không phải bằng chứng chắc chắn cho tương lai. Đó là lý do
§2.6 có thêm dấu hiệu để gộp hay tách lại khi dự án chạy.

### 2.3. Kịch bản thay đổi: đổi gì thì triển khai lại cái gì

Lợi ích thật của ranh giới tốt là **một thay đổi nghiệp vụ chỉ chạm một service**.

| Thay đổi có thật trong vòng đời sản phẩm | Service phải sửa và triển khai lại | Service không đụng |
| --- | --- | --- |
| Pháp chế đổi công thức phạt, thêm luật mới cho hợp đồng phần mềm | decision (phiên bản luật mới) | còn lại; hợp đồng cũ vẫn chấm theo phiên bản cũ |
| Bên mua đổi ngân hàng, ngân hàng đổi API | payment | còn lại |
| Chuyển từ chữ ký mô phỏng sang chữ ký số của một CA được cấp phép | signing | còn lại |
| Thêm loại hợp đồng "bảo trì" với mẫu mốc riêng | contract (mẫu), decision (luật nếu khác) | execution, payment, audit |
| Quy định mới về trường bắt buộc của hoá đơn điện tử | execution (+ màn nộp chứng từ) | còn lại |
| Thời hạn lưu nhật ký đổi từ 10 lên 15 năm, thêm neo dấu thời gian bên ngoài | audit | còn lại |
| Thêm đăng nhập một lần (SSO) cho khách hàng doanh nghiệp | identity (+ gateway nếu đổi cách kiểm token) | mọi service nghiệp vụ (vẫn kiểm JWT như cũ) |

Ở bản một khối, mỗi dòng trên là một lần triển khai lại **toàn bộ** hệ, kể cả phần chi tiền đang chạy.

### 2.4. Kịch bản sự cố: hỏng một chỗ thì cả hệ ra sao

| Sự cố | Bản một khối | Bản tách service |
| --- | --- | --- |
| Ngân hàng chậm 30 giây mỗi lệnh | kết nối dồn lại trong cùng một tiến trình; các màn khác chậm theo | payment trả `PENDING`, circuit breaker mở; soạn, ký, nộp chứng từ không biết gì (F2) |
| Engine lỗi sau khi cập nhật bộ luật | cả API phải quay lại bản trước | quay lại riêng decision; trong lúc đó mốc `PENDING_EVALUATION`, không mất chứng từ (F1) |
| Nhà cung cấp ký sập | | chỉ ký bị chờ (`PENDING_PROVIDER`); hợp đồng đang thực hiện không ảnh hưởng (F3) |
| Một lỗi bảo mật ở màn soạn hợp đồng cho đọc được database | đọc được mọi bảng, kể cả mật khẩu băm và lệnh chi | chỉ đọc được database của contract; mật khẩu ở identity, lệnh chi ở payment, tài khoản DB riêng (`infra/postgres-init.sql`) |
| Quản trị execution muốn sửa lịch sử duyệt cho khớp | sửa được cả bảng audit | audit là database khác, tài khoản khác; bản sao nhật ký và đầu chuỗi băm của từng service để đối chiếu (L7) |

### 2.5. Ranh giới yếu và cách giảm

**contract ↔ execution, contract ↔ signing** (contract chỉ đổi một mình 20%). Nguyên nhân ở CodeCash:
bản nháp, văn bản và hợp đồng đang thực hiện dùng chung một tệp kiểu (`types.ts` 1.707 dòng) và chung
bảng. Tách mà vẫn chung kiểu thì mỗi lần thêm trường là sửa ba service. Cách giảm:

1. **Gói hợp đồng v1 là hợp đồng duy nhất giữa ba bên.** contract và signing phát ra gói; execution
   chỉ đọc gói. Thêm trường vào bản nháp không đụng execution, trừ khi trường đó vào gói.
2. Gói có **phiên bản** (`SCW_CONTRACT_PACKAGE_V1`);
   đổi gói thì tăng phiên bản, execution nhận được cả hai phiên bản trong thời gian chuyển.
3. Không chép `types.ts` chung: mỗi service tự khai kiểu của mình; chỉ kiểu của gói và của sự kiện nằm
   trong `packages/contracts`.

**audit ↔ mọi service** (audit đổi kèm tính năng). Nguyên nhân: mỗi tính năng mới thêm một loại mục
nhật ký và màn hiển thị nó. Cách giảm: **một phong bì sự kiện chung** (ai, làm gì, trên tài nguyên nào,
lúc nào, mã băm trước/sau, `requestId`), audit lưu và kiểm mọi loại mà không cần biết từng loại; chỉ chữ
hiển thị là theo loại (ở web).

**execution ↔ signing** (cặp dính nhất, 6 commit): do tệp chứng từ và văn bản hợp đồng dùng chung kho
tài liệu. Giữ một kho tài liệu duy nhất ở signing (băm, lưu, quyền xem); execution chỉ giữ mã tài liệu
của chứng từ. Không làm kho tài liệu thứ hai.

### 2.6. So với các phương án chia khác

Đếm lời gọi đồng bộ giữa service trên ba luồng hay chạy nhất: một lần **phê duyệt** (L4), một **lượt
ký** (L3), một **lệnh chi** (L6).

| Phương án | Số service nghiệp vụ | Phê duyệt | Lượt ký | Lệnh chi | Vấn đề |
| --- | --- | --- | --- | --- | --- |
| **Đang chọn** | 6 | 1 (execution → decision) | 0 (lượt cuối: 1 sang contract) | 2 (→ execution, → decision) + ngân hàng | contract là ranh giới yếu (§2.5) |
| Gộp thô: soạn+ký, thực hiện+quyết định+chi, kiểm toán | 3 | 0 | 0 | 0 | không đủ ≥ 5 service của đề; engine Python vẫn phải chạy riêng; lỗi ngân hàng và cập nhật luật kéo cả phần thực hiện; quyền chi tiền và quyền nộp chứng từ chung một database |
| Chia theo bảng (mỗi thực thể một service: hợp đồng, mốc, chứng từ, phê duyệt, tranh chấp…) | 10+ | 3–4: decision cần chứng từ, phê duyệt, tranh chấp của cùng mốc từ ba nơi | 1 (kiểm mã băm ở dịch vụ tài liệu) | 3–4 | engine coi chứng từ, phê duyệt, từ chối, tranh chấp là **một dòng sự kiện của mốc** (tranh chấp có thể phạm vi cả hợp đồng); chia ra thì không còn một thời điểm nhất quán để chấm, "đủ người duyệt chưa" thành câu hỏi phân tán |
| Tách thêm tài liệu, thông báo, bộ luật thành service riêng | 9 | 1 | 1 | 2 | thêm 3 repo, 3 database cho 6 người trong 3 tuần mà không có tiêu chí nào khác biệt đủ mạnh (§2.1) |

Phương án đang chọn đặt **đúng một lời gọi chéo** trên đường phê duyệt (luồng chạy nhiều nhất của nửa
sau vòng đời) và chi tiền là nơi duy nhất có hai lời gọi, đúng chỗ cần saga để an toàn.

### 2.7. Trong thực tế người ta tách thế nào

Các phần mềm hợp đồng điện tử, ký số, thanh toán và hoá đơn điện tử ngoài thị trường **vốn đã là các hệ
riêng** nói chuyện với nhau qua API: doanh nghiệp dùng một dịch vụ ký số của nhà cung cấp được cấp phép,
gửi lệnh chi qua ngân hàng hoặc cổng thanh toán, phát hành hoá đơn qua nhà cung cấp hoá đơn điện tử, đẩy
nhật ký sang hệ lưu trữ hoặc giám sát riêng. Ranh giới signing, payment, audit của SCW trùng đúng các
đường nối đó; khi sản phẩm lớn lên, mỗi service là chỗ thay bằng nhà cung cấp thật mà không đụng phần còn
lại (§2.3). Phần riêng của SCW, không ai bán sẵn, là contract + execution + decision: luật thanh toán
theo mốc và việc chấm có vết.

### 2.8. Khi nào gộp lại hay tách thêm

| Dấu hiệu | Làm gì |
| --- | --- |
| Hai service bị sửa cùng PR trong hơn một nửa số thay đổi suốt 2 tuần | xem lại ranh giới; thường là gói hoặc sự kiện thiếu trường; nếu không phải thì gộp |
| Một lời gọi chéo xuất hiện trên đường đọc (màn danh sách) | thiếu ảnh chụp dữ liệu; thêm vào gói hoặc sự kiện, không gọi chéo khi đọc |
| Một service có hai nhóm người dùng với quy tắc khác hẳn nhau, mỗi nhóm đổi một kiểu | cân nhắc tách (ví dụ thông báo khỏi audit khi có nhiều kênh gửi) |
| Một service sinh lỗi kéo theo service khác trong thí nghiệm | thiếu timeout, PENDING hoặc hàng đợi ở lời gọi đó (§3) |

### 2.9. Ba ranh giới dữ liệu đã chốt

1. **Ai sở hữu tổ chức.** identity sở hữu `organizations` (công ty, mã số thuế). execution có `parties`
   của dữ liệu mẫu: đây là **bản sao chỉ đọc** theo mã của identity, đến qua gói hợp đồng (S2) hoặc lúc
   nạp dữ liệu mẫu, không bao giờ sửa ở execution. Hạn mức duyệt của từng bên (engine dùng khi đếm phê
   duyệt) đi kèm bản sao này.
2. **Hợp đồng nằm ở hai nơi** là cố ý, giống "đơn hàng" và "giao hàng" trong thương mại điện tử.
   contract giữ bản đang soạn; execution giữ ảnh chụp đã ký (gói v1, kèm mã băm văn bản). Ký xong, sửa
   chỉ bằng phụ lục ở execution, không sửa bản nháp.
3. **decision không gọi ngược execution.** execution gửi trọn **gói dữ kiện của một mốc** (mốc, hợp
   đồng, các bên, dòng sự kiện, luật) trong request; decision tính rồi lưu kết quả và vết. Như vậy đồ thị
   gọi đồng bộ không có vòng (§5), và decision chạy được độc lập, dễ test và đo.

## 3. Đồng bộ hay bất đồng bộ, vì sao

Nguyên tắc: **gọi đồng bộ khi người dùng cần kết quả ngay và bên gọi không làm được gì nếu không có nó.
Bất đồng bộ khi bên phát không được phép phụ thuộc vào việc bên nhận đang sống, và kết quả đến chậm vài
giây vẫn đúng.**

| Tương tác | Kiểu | Vì sao |
| --- | --- | --- |
| Web → gateway → một service (mọi lần đọc, mọi thao tác) | đồng bộ HTTP | người dùng chờ kết quả |
| signing → contract: `AGREED → SIGNING`, `SIGNING → ACTIVE` | đồng bộ | phải biết chắc hợp đồng đã khoá trước khi cho ký |
| signing → nhà cung cấp ký | đồng bộ, timeout 3 s → PENDING | người ký chờ; hết giờ thì "đã nhận, chưa biết", đối soát sau |
| execution → decision: chấm mốc sau chứng từ, phê duyệt | đồng bộ, timeout 2 s → PENDING_EVALUATION | người duyệt muốn thấy ngay "đủ điều kiện chưa"; decision sập thì không mất chứng từ |
| payment → execution (khoá mốc), payment → decision (xác nhận) | đồng bộ | là các bước của saga S4, phải biết kết quả từng bước |
| payment → ngân hàng | đồng bộ, timeout 3 s → PENDING | như nhà cung cấp ký |
| signing → execution: hợp đồng đã ký (`contract.activated`) | **bất đồng bộ** | chữ ký đã có giá trị; execution sập lúc đó không được làm hỏng lượt ký, và không được mất hợp đồng |
| Mọi service → audit: mục nhật ký | **bất đồng bộ** | nhật ký trung tâm không được làm chậm hay chặn thao tác của người dùng |
| Mọi service → thông báo, email | **bất đồng bộ** | gửi mail chậm, hay lỗi; người dùng không chờ mail |
| payment → execution: đã chi (`payment.settled`) | **bất đồng bộ** | ngân hàng có thể báo về muộn (đối soát); mốc đổi sang đã chi khi có kết quả |

**Đường đọc không có lời gọi chéo.** Màn danh sách, việc cần làm, chi tiết mốc (các thao tác nhiều
nhất) chỉ đi web → gateway → **một** service, vì mỗi service có đủ dữ liệu của mình (nhờ ảnh chụp ở
§2). Lời gọi chéo chỉ xảy ra ở vài bước chuyển trạng thái. Đây là lý do 7 service vẫn nhanh như một.

## 4. Từng công nghệ: giải quyết gì, không có thì sao

| Thành phần | Giải quyết gì | Không có thì sao | Vì sao chọn cái này |
| --- | --- | --- | --- |
| **API gateway** (tự viết, `gateway/`) | Một địa chỉ cho web và Postman; kiểm token lớp 1; giới hạn số request; CORS; request id; 503/504 thống nhất | Web phải biết 7 cổng, CORS cấu hình 7 nơi, service lộ ra ngoài, không chặn được dò mật khẩu ở một chỗ | Tự viết ~250 dòng: giải thích được từng chính sách khi vấn đáp, không có luật nghiệp vụ. Kong/Traefik mạnh hơn nhưng là cấu hình, không chấm được kiến thức, và thêm một hệ phải học |
| **JWT RS256 + JWKS** | Service kiểm token không cần gọi identity; chỉ identity ký được | Mỗi request gọi identity (identity thành điểm nghẽn, sập là cả hệ sập); hoặc dùng chung một bí mật (lộ một service là giả được token của mọi người) | Chuẩn OAuth/OIDC; HS256 với bí mật chung đã bỏ vì lý do trên |
| **Access 15 phút + refresh xoay vòng** | Service khác không kiểm thu hồi, nên token bị lộ chỉ dùng được tối đa 15 phút; refresh token bị chép thì phát hiện khi dùng lại | Token 8 giờ: khoá tài khoản xong người đó vẫn thao tác cả ngày ở service khác | OAuth 2.0 Security BCP; cookie HttpOnly để script trên trang không đọc được |
| **Database riêng mỗi service** (cùng một máy Postgres) | Không service nào đọc trộm bảng của service khác; đổi schema không làm vỡ ai | Ai cũng join bảng của nhau → thực chất là monolith phân tán, sửa một bảng vỡ ba service | Một máy Postgres nhiều database: đúng ranh giới mà không tốn 7 máy chủ; ở thật thì tách máy khi cần |
| **Saga điều phối + bù trừ** (S1, S4) | Thay giao dịch xuyên database (không có) | Lỗi giữa chừng để lại hợp đồng kẹt ở `SIGNING`, hay mốc kẹt `PAYMENT_REQUESTED` mãi | Điều phối tập trung dễ log, dễ giải thích hơn "choreography" (mỗi service tự phản ứng sự kiện). 2PC không dùng được qua HTTP và khoá dữ liệu lâu |
| **Idempotency-Key** khi chi tiền và khi ký | Gửi lại sau timeout không tạo lệnh thứ hai | Timeout lúc ngân hàng đã chi → bấm lại → **chi hai lần**. Đây là lỗi đắt nhất của hệ | Cách các API thanh toán làm: Stripe dùng đúng header này; cổng thanh toán trong nước dùng mã giao dịch duy nhất cho cùng mục đích |
| **Trạng thái PENDING + job đối soát** | Thành thật với "đã gửi nhưng không biết kết quả" | Đoán thành công (có thể chưa chi) hoặc đoán thất bại (gửi lại → chi trùng) | Đây là cách ngân hàng thật vận hành; job hỏi lại theo khoá |
| **Outbox** (ghi sự kiện cùng giao dịch với dữ liệu) | Không mất sự kiện khi service chết giữa "ghi DB" và "gửi sự kiện" | Hợp đồng đã ký nhưng execution không bao giờ biết; chi xong nhưng mốc vẫn "chờ chi" | Chassis **đã** ghi mục nhật ký trong cùng giao dịch với dữ liệu (`Repository.mutate`): chính mục đó là hàng outbox, chỉ cần tiến trình đẩy đi |
| **Hàng đợi RabbitMQ** (§6) | Đệm và phát một sự kiện cho nhiều bên nhận; thử lại; DLQ giữ message hỏng | Xem §6: phần lớn làm được bằng outbox + HTTP; hàng đợi đáng dùng ở chỗ nhiều bên nhận | RabbitMQ: có sẵn dead-letter exchange, giao diện quản trị để demo, nhẹ. Kafka giữ log để phát lại ở quy mô lớn, cần cụm và vận hành nặng: thừa. Redis Streams nhẹ nhưng DLQ phải tự làm |
| **Consumer idempotent** (`processed-messages`) | Hàng đợi giao "ít nhất một lần"; message đến hai lần không được ghi hai lần | Nhập một hợp đồng hai lần, ghi một mục nhật ký hai lần | Bảng khoá duy nhất theo `messageId` là cách đơn giản và chắc nhất |
| **Circuit breaker + bulkhead** (chỉ quanh ngân hàng và nhà cung cấp ký) | Ngân hàng chậm thì ngừng gọi một lúc, trả lỗi nhanh, không dồn hàng trăm kết nối treo | Mỗi request chờ đủ timeout, kết nối dồn lên, gateway timeout lan sang cả những màn không liên quan | Chỉ đặt ở phụ thuộc **ngoài**, không đặt ở mọi lời gọi nội bộ (tải nội bộ thấp, thêm vào chỉ làm khó debug) |
| **Nhật ký chuỗi băm** | Kiểm toán biết có ai sửa hay xoá lịch sử không | Người có quyền DB sửa lại "ai duyệt, lúc nào" mà không ai biết | Mỗi mục chứa băm của mục trước; `GET /audit/verify` tính lại. Blockchain thật là thừa: không có nhiều bên không tin nhau cùng ghi |
| **Engine Python giữ nguyên** | Quyết định đã kiểm chứng trên 405 mốc của dữ liệu mẫu | Viết lại: mất bằng chứng đúng, rủi ro sai số tiền | FastAPI bọc mỏng quanh `codecash_engine.evaluate` |
| **Docker + `docker compose`** | Máy chấm chạy cả hệ bằng một lệnh, đúng phiên bản (MS-R7) | "Máy em chạy được": thiếu Postgres, sai phiên bản Node, quên biến môi trường | Kubernetes giải quyết nhiều máy, tự co giãn: không có nhu cầu đó; compose là đủ và đề yêu cầu |
| **Request id xuyên service** | Lần một lỗi qua gateway → signing → contract bằng một mã | Ba service ba log, không biết dòng nào thuộc request nào | Header `x-request-id`, đã có sẵn. Grafana/Loki chỉ làm nếu dư thời gian |
| **k6** | Số liệu thí nghiệm lỗi trước và sau (MS-R8) | Không có số, chỉ có "em thấy nó chạy" | Viết kịch bản bằng JavaScript, chạy trong container |
| **ServiceClient** (timeout, thử lại có điều kiện) | Mọi lời gọi chéo cùng một quy tắc: không treo mãi, không thử lại 4xx, phân biệt lỗi nghiệp vụ và lỗi hạ tầng (MS-R5) | Mỗi người tự viết `fetch`, có chỗ không timeout, có chỗ thử lại cả POST chi tiền | Một thư viện trong chassis, có test |

## 5. Đồ thị phụ thuộc

```mermaid
flowchart LR
  web[Web] --> gw[gateway]
  gw --> idn[identity] & ctr[contract] & sig[signing] & exe[execution] & dec[decision] & pay[payment] & aud[audit]
  sig -- "đồng bộ: khoá / kích hoạt" --> ctr
  sig -- "đồng bộ, timeout → PENDING" --> esp[(nhà cung cấp ký mô phỏng)]
  exe -- "đồng bộ, timeout → PENDING_EVALUATION" --> dec
  pay -- "đồng bộ: khoá mốc" --> exe
  pay -- "đồng bộ: xác nhận" --> dec
  pay -- "đồng bộ, timeout → PENDING" --> bank[(ngân hàng mô phỏng)]
  sig -. "contract.activated" .-> mq{{RabbitMQ}}
  pay -. "payment.settled" .-> mq
  ctr & sig & exe & dec & pay & idn -. "mục nhật ký (outbox)" .-> mq
  mq -. "nhập hợp đồng, cập nhật đã chi" .-> exe
  mq -. "nhật ký, thông báo" .-> aud
```

Nét liền (đồng bộ) không có vòng: contract và decision không gọi ai; execution chỉ gọi decision;
payment gọi execution và decision. Nhờ vậy không có kiểu "A chờ B, B chờ A" khi một service chậm. Nét
đứt đi qua hàng đợi, nên bên phát không cần bên nhận đang sống.

## 6. Có cần hàng đợi không

Trả lời thẳng: **không cần cho luồng tiền và luồng quyết định**. Chúng đồng bộ, có PENDING và đối
soát; thêm hàng đợi chỉ làm khó theo dõi.

**Cần**, và chỉ ở ba chỗ, vì cùng một lý do (bên phát không được phụ thuộc bên nhận, và nhiều bên cùng
nhận):

1. **`contract.activated`** (S2): signing phát một lần, execution nhập hợp đồng, audit ghi, thông báo
   gửi cho hai bên. Không có hàng đợi thì signing phải gọi lần lượt ba nơi và tự thử lại từng nơi.
2. **Nhật ký về audit**: mọi service đều phát, mỗi thao tác một mục. Gọi HTTP đồng bộ thì audit chậm
   làm chậm mọi thao tác, audit sập thì không ai thao tác được.
3. **Thông báo**: email chậm và hay lỗi; người dùng không được chờ.

Nếu thiếu thời gian, phương án tối thiểu vẫn đúng: **outbox + tiến trình gửi HTTP có thử lại** (không
broker). Mất điểm cộng MS-B1 (+0,5) nhưng không mất tính đúng. Vì thế thứ tự làm là: outbox trước (bắt
buộc cho đúng), broker sau (điểm cộng và gọn hơn khi nhiều bên nhận).

## 7. Có cần CI không, vì sao GitHub Actions

CI trả lời câu "PR này có làm hỏng gì không" **trước khi** merge, cho cả sáu người, mỗi lần push. Không
có CI thì lỗi chỉ lộ ra ở ngày tích hợp, khi đã chồng lên bốn PR khác và không biết PR nào gây ra.

Ở đây CI làm năm việc, việc nào cũng chặn một lỗi thật đã gặp hoặc sẽ gặp:

| Bước | Chặn lỗi gì |
| --- | --- |
| `check-base-untouched` | AI "sửa chassis cho chạy được" trong repo service, lần đồng bộ sau xung đột |
| `check-docs-updated` | mã đổi mà `SERVICE.md` không đổi, AI lần sau đọc tài liệu sai |
| typecheck, lint, format, test (có Postgres thật) | lỗi kiểu, quên `await`, sai luật nghiệp vụ |
| build image và chạy ở chế độ production | thiếu biến môi trường (production đòi khoá ký token), thiếu tệp trong image |
| job `stack`: `docker compose up` + Newman qua gateway | service chạy riêng thì được, ghép lại thì không (sai route, sai cổng, token không qua gateway) |

**Vì sao GitHub Actions mà không CircleCI, GitLab CI, Jenkins:**

- Repo nằm trên GitHub và để **public**: GitHub Actions miễn phí, không giới hạn phút với runner
  chuẩn cho repo public. CircleCI gói miễn phí tính theo credit mỗi tháng; sáu người push cả ngày, cộng
  job build image và compose, dễ hết vào tuần cuối, đúng lúc cần CI nhất. (Nếu chuyển repo sang
  private, Actions còn một hạn mức phút miễn phí mỗi tháng; khi đó cần theo dõi, nhưng vẫn không lợi gì
  khi chuyển sang CircleCI.)
- **Gắn thẳng với bảo vệ nhánh**: "PR phải qua `verify`" là một ô tích trong cài đặt nhánh, không cần
  cài app hay webhook.
- Runner Ubuntu có sẵn Docker và service container Postgres: job `stack` chạy được không cần cấu hình
  thêm.
- Jenkins cần một máy chủ để tự nuôi; GitLab CI cần chuyển repo sang GitLab. Không có lợi ích nào bù
  được chi phí đó.

**CD (triển khai tự động) chưa cần.** Đề yêu cầu demo trực tiếp trên máy nhóm, chạy bằng compose. Nếu
làm mục "Could" (đường link có HTTPS), bước rẻ nhất là thêm vào job hiện có: build image rồi đẩy lên
GitHub Container Registry khi merge vào `main`; máy chủ demo chỉ `docker compose pull && up`. Không
dựng Kubernetes, không ArgoCD.

## 8. Các luồng chính: đi qua đâu, đồng bộ ra sao

Ký hiệu: **→** gọi đồng bộ qua `ServiceClient`; **⇢** sự kiện qua outbox và hàng đợi. Web luôn vào qua
gateway (lớp 1 kiểm token), không ghi lại ở mỗi dòng.

### L1. Đăng ký, đăng nhập, mời thành viên (xong)

web → identity. Không lời gọi chéo. identity ⇢ audit (`REGISTER`, `LOGIN`, `INVITE`…). Token RS256
phát ra; mọi service sau đó kiểm bằng JWKS, không gọi lại identity.

### L2. Soạn và rà soát hợp đồng (bên mua soạn, nhà cung cấp rà soát)

1. web → contract: tạo từ mẫu, sửa điều khoản, `PUT /milestones` (BR-A03…A05), `PUT /members`
   (BR-A06, A07). Lưu nháp nhiều lần, chỉ contract.
2. `SUBMIT_REVIEW` → `IN_REVIEW`; contract ⇢ `contract.review_requested` → audit gửi thông báo cho bên
   kia.
3. Nhà cung cấp bình luận, `REQUEST_CHANGES` hoặc `CONFIRM`. Hai bên cùng `CONFIRM` → `AGREED`
   (BR-A08); contract ⇢ `contract.agreed`.

Toàn bộ trong một service; tần suất cao nhất của nửa đầu vòng đời, không gọi chéo.

### L3. Ký và kích hoạt (S1, S2)

```mermaid
sequenceDiagram
  participant W as Web
  participant SG as signing
  participant C as contract
  participant SP as nhà cung cấp ký
  participant Q as hàng đợi
  participant E as execution
  W->>SG: POST /signing-sessions
  SG->>C: AGREED → SIGNING (khoá điều khoản)
  SG->>SG: dựng văn bản, đóng băng, mã băm; tạo lượt ký
  Note over SG,C: lỗi ở bước tạo lượt: huỷ văn bản, C về AGREED (bù trừ S1)
  loop từng người ký, đúng thứ tự (BR-A09)
    W->>SG: POST /steps/{n}/sign + Idempotency-Key
    SG->>SP: ký (timeout 3 s)
    alt hết giờ
      SG-->>W: 202 PENDING_PROVIDER (job đối soát hỏi lại)
    else xong
      SG-->>W: 200 SIGNED, lượt sau sang CURRENT
    end
  end
  SG->>SG: lượt cuối: niêm phong văn bản
  SG->>C: SIGNING → ACTIVE
  SG--)Q: contract.activated + gói hợp đồng v1 (outbox, cùng giao dịch)
  Q--)E: nhập ảnh chụp hợp đồng (idempotent theo contract.id)
  Q--)E: (execution đang sập: message nằm chờ, nhập khi sống lại)
```

### L4. Nộp chứng từ, phê duyệt, engine chấm (S3)

```mermaid
sequenceDiagram
  participant W as Web (nhà cung cấp / chủ hợp đồng)
  participant E as execution
  participant D as decision
  participant Q as hàng đợi
  W->>E: POST /milestones/{id}/evidence (BR-B03, B08, B11)
  E->>E: lưu chứng từ (201, không bao giờ mất)
  E->>D: POST /evaluations { gói dữ kiện của mốc } (timeout 2 s)
  alt decision trả lời
    D-->>E: HOLD/RELEASE/PENALTY/REJECT + vết luật
    E->>E: cập nhật trạng thái mốc, "việc còn lại" (ai phải làm gì tiếp)
  else decision sập / chậm
    E->>E: mốc PENDING_EVALUATION
    Note over E: job mỗi 10 s chấm lại các mốc PENDING_EVALUATION khi decision sống lại
  end
  E--)Q: evidence.submitted, decision.made → audit
  W->>E: POST /milestones/{id}/approvals (BR-B05) → chấm lại như trên
```

Đây là luồng chạy nhiều nhất của nửa sau. Chấm đồng bộ vì người duyệt cần thấy ngay "đã đủ điều kiện
chi chưa"; PENDING_EVALUATION để không phụ thuộc vào việc decision đang sống.

### L5. Tranh chấp, ngoại lệ, phụ lục

- Tranh chấp: web → execution mở (BR-B09) → chấm lại → HOLD (BR-B01). Bên mua đóng → chấm lại.
- Ngoại lệ (bỏ một chứng từ sai): chủ hợp đồng đề xuất, kiểm soát viên duyệt (BR-B12, SoD-2) → chấm lại.
- Phụ lục dời hạn: execution tạo, nhà cung cấp chấp nhận → hạn mốc mới → chấm lại.

Đều trong execution, mỗi lần đổi đều đi qua cùng một hàm chấm như L4.

### L6. Lập và chi lệnh (S4)

Sơ đồ ở `PHAN_TICH_THIET_KE.md` §8. Tóm tắt: web → payment `POST /payment-orders` + `Idempotency-Key`
→ execution khoá mốc `PAYMENT_REQUESTED` → decision xác nhận quyết định hiện hành còn trả tiền (BR-B10)
→ lệnh `APPROVED` → phê duyệt tài chính duyệt → ngân hàng (timeout 3 s, circuit breaker): `SENT` |
`PENDING` (đối soát theo khoá) | `FAILED` (bù trừ: trả mốc về trạng thái trước). Khi có kết quả:
payment ⇢ `payment.settled` → execution đánh dấu đã chi, audit ghi.

Vì sao chi tiền không dùng hàng đợi: phê duyệt tài chính phải thấy ngay "đã gửi", "đang chờ ngân hàng"
hay "bị từ chối"; mọi trường hợp không chắc đã có PENDING và đối soát lo.

### L7. Kiểm toán và xác minh

- Kiểm toán viên: web → audit `GET /audit/verify` tính lại chuỗi băm. Mỗi service giữ chuỗi băm của
  mình (cùng giao dịch với dữ liệu); audit nhận bản sao qua hàng đợi và đối chiếu mã băm đầu chuỗi của
  từng service, nên sửa ở một nơi là lộ.
- Khách: web → signing `GET /public/verify?hash=` → văn bản có đúng là bản đã niêm phong không.

### L8. Thanh lý

Mọi mốc đã chi hoặc bị từ chối → execution lập biên bản thanh lý với số liệu chốt (đã chi + phạt + bị
từ chối = giá trị hợp đồng) → nhà cung cấp xác nhận → hợp đồng khoá hẳn; execution ⇢ audit.

## 9. Những gì cố ý không làm

| Không làm | Vì sao |
| --- | --- |
| Kubernetes, service mesh | Không có nhu cầu nhiều máy, tự co giãn; compose đủ và đề yêu cầu |
| Kafka | Không cần giữ log để phát lại ở quy mô lớn; RabbitMQ đủ và nhẹ |
| Blockchain thật | Không có nhiều tổ chức không tin nhau cùng ghi; chuỗi băm + neo Merkle đạt mục đích kiểm toán |
| Circuit breaker ở mọi lời gọi nội bộ | Tải nội bộ thấp; chỉ đặt ở ngân hàng và nhà cung cấp ký |
| Cache (Redis) | Đường đọc một service, dữ liệu nhỏ; chưa có số đo nào cho thấy chậm |
| GraphQL / BFF | Mỗi màn gọi một service; REST + OpenAPI là đề yêu cầu |
| Event sourcing | Trạng thái hiện tại + nhật ký chuỗi băm đủ để tái dựng "vì sao"; event sourcing tăng độ khó mà không thêm điều gì cần |

## 10. Rủi ro và cách giảm

| Rủi ro | Giảm bằng |
| --- | --- |
| 7 service cho 6 người trong 3 tuần | phần nền đã xong; mỗi người một service; TV5 hai service vì decision chỉ là lớp mỏng quanh engine; thiếu giờ thì bỏ broker (§6), giữ outbox |
| Token đã đăng xuất còn dùng được ở service khác tới 15 phút | chấp nhận có ý thức; sau này phát `user.disabled` để service chặn sớm |
| Dữ liệu tổ chức lệch giữa identity và execution | identity là nguồn; execution chỉ giữ bản sao theo mã, đến qua gói hợp đồng |
| Lệnh chi trùng | `Idempotency-Key`, một lệnh mỗi mốc (BR-B10), khoá mốc `PAYMENT_REQUESTED`, PENDING thay vì đoán |
| Mất sự kiện giữa các service | outbox trong cùng giao dịch; consumer idempotent; DLQ có màn xem và đẩy lại |
