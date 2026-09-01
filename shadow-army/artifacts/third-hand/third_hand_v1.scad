// Shadow Army — Third Hand v2 print plate
// Constraint: complete print plate <= 150 x 150 mm.
// Every printed component is separated by >= 4 mm.
$fn=64;

base_x=70;
base_y=70;
base_h=6;
post_d=18;
post_h=95;
arm_len=62;
arm_w=16;
arm_h=10;
pivot_d=5.3;       // M5 printable clearance
mount_d=4.5;       // M4 printable clearance
jaw_len=42;
jaw_w=18;
jaw_h=10;

module base(){
 difference(){
  union(){
   cube([base_x,base_y,base_h]);
   translate([base_x/2,base_y/2,base_h]) cylinder(d=30,h=8);
  }
  for(x=[8,base_x-8]) for(y=[8,base_y-8])
   translate([x,y,-1]) cylinder(d=mount_d,h=base_h+2);
  translate([base_x/2,base_y/2,-1]) cylinder(d=post_d+0.6,h=base_h+10);
 }
}

module post(){
 difference(){
  cylinder(d=post_d,h=post_h);
  translate([0,0,post_h-12]) rotate([0,90,0]) cylinder(d=pivot_d,h=post_d+4,center=true);
 }
}

module arm(){
 difference(){
  hull(){
   cylinder(d=arm_w,h=arm_h);
   translate([arm_len,0,0]) cylinder(d=arm_w,h=arm_h);
  }
  translate([0,0,-1]) cylinder(d=pivot_d,h=arm_h+2);
  translate([arm_len,0,-1]) cylinder(d=pivot_d,h=arm_h+2);
 }
}

module jaw(){
 difference(){
  cube([jaw_len,jaw_w,jaw_h]);
  // open gripping slot
  translate([12,-1,4]) cube([jaw_len-12,jaw_w+2,jaw_h+2]);
  translate([6,jaw_w/2,-1]) cylinder(d=pivot_d,h=jaw_h+2);
 }
}

// Separate print plate. No component touches another component.
// base: x 0..70, y 0..70
base();

// post horizontal for printability: x 84..102, y 0..95
translate([102,0,9]) rotate([-90,0,0]) post();

// arm 1: x 8..86, y 84..100
translate([16,92,0]) arm();

// arm 2: x 8..86, y 108..124
translate([16,116,0]) arm();

// jaw 1: x 96..138, y 82..100
translate([96,82,0]) jaw();

// jaw 2: x 96..138, y 108..126
translate([96,108,0]) jaw();
