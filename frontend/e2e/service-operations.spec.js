import {test,expect} from '@playwright/test';
test('my services unifies four purchases with separate usage rules',async({page})=>{
 const session={user:{id:'member',role:'member',displayName:'Khách hàng',mustChangePassword:false,profileSetupRequired:false},permissions:['membership.self.read','course.enroll','course.read','pt.read','pt.purchase','facility.booking.self.read','facility.booking.request','booking.read']};
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data=[];
  if(path.endsWith('/auth/me'))data=session;
  else if(path.endsWith('/members/me/memberships'))data=[{id:'m',package_name_snapshot:'Gym tháng',status:'active',expires_on:'2099-04-30'}];
  else if(path.endsWith('/course-enrollments/me'))data=[{id:'c',course:{name:'Yoga 12 buổi'},status:'pending_payment'}];
  else if(path.endsWith('/pt-purchases'))data=[{id:'p',package_name_snapshot:'PT 10 buổi',status:'active',usedSessions:2,remainingSessions:7,session_count_snapshot:10,expires_at:'2099-04-30T00:00:00Z'}];
  else if(path.endsWith('/facility-reservations/me'))data=[{id:'r',facilityName:'Sân bóng',date:'2099-04-01',status:'approved',totalVnd:'500000',paymentState:'paid'}];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
 });
 await page.goto('/my/services');
 await expect(page.getByRole('heading',{name:'Dịch vụ của tôi',exact:true})).toBeVisible();
 for(const name of ['Gym tháng','Yoga 12 buổi','PT 10 buổi','Sân bóng'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Huấn luyện cá nhân'})).toContainText('7/10');
 await expect(page.getByRole('region',{name:'Thuê sân/phòng'})).toContainText('Đã thanh toán');
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.reload();await expect(page.getByRole('heading',{name:'Yoga 12 buổi'})).toBeVisible();
});
test('rental payment uses approved quote and survives reload',async({page})=>{
 const session={user:{id:'member',role:'member',displayName:'Khách hàng',mustChangePassword:false,profileSetupRequired:false},permissions:['facility.booking.self.read','facility.booking.request','facility.booking.cancel','payment.self.read']};
 const item={id:'r',dayId:'d',date:'2099-04-01',facilityName:'Phòng Yoga',status:'approved',assignedStartMinute:480,assignedEndMinute:570,requestedStartMinute:480,requestedEndMinute:570,totalVnd:'150000',hourlyRateVnd:'100000',paymentState:'unpaid'};
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data=[];
  if(path.endsWith('/auth/me'))data=session;
  else if(path.endsWith('/public/facility-calendar'))data={types:[],facilities:[],days:[]};
  else if(path.endsWith('/facility-reservations/me'))data=[item];
  else if(path.endsWith('/facility-reservations/r/payment')){expect(route.request().postDataJSON()).toEqual({method:'bank_transfer'});data={id:'pay',transaction_code:'PAY-RENTAL',amountVnd:'150000',status:'pending'};}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
 });
 await page.goto('/facilities');
 await expect(page.getByText('Giá đã chốt:',{exact:false})).toContainText('150.000 đ');
 await page.getByRole('button',{name:'Thanh toán chuyển khoản',exact:true}).click();
 await expect(page.getByRole('region',{name:'Thanh toán đặt sân'})).toContainText('PAY-RENTAL');
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
 await page.reload();await expect(page.getByText('Giá đã chốt:',{exact:false})).toContainText('150.000 đ');
});
